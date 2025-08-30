import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";

import axios from "axios";
import { redis } from "../lib/redis";
import { openai } from "../lib/openai";
import { containerClient } from "../lib/storage";
import { ImageProcessor, ProcessedImage } from "../lib/sharp";

import {
  applyRateLimiter,
  rateLimiter,
  checkUsageStatus,
  incrementUsageCounter,
} from "../lib/rate-limiter";

const CONSTANTS = {
  OPENAI_GPT_MODEL: "gpt-4.1-nano",
  OPENAI_IMAGE_MODEL: "dall-e-3",
  IMAGE_SIZE: "1024x1024" as const,
  INSUFFICIENT_DETAIL_KEY: "insufficient_detail",
  MAX_COMPLETION_TOKENS: 50,
  TEMPERATURE: 0.7,
  SIX_HOURS_IN_SECONDS: 6 * 60 * 60,
  CACHE_CONTROL_HEADER: "public, max-age=31536000", // 1 year
  IMAGE_CACHE_KEY: "images:all",
};

const UserPromptOptimizerPrompt = `
You are an Expert DALL-E Prompt Optimizer. Your primary objective is to transform user prompts into visually-rich, AI-optimized descriptions that maximize DALL-E's image generation quality while staying under ${CONSTANTS.MAX_COMPLETION_TOKENS} tokens.

---

### MASTER INSTRUCTIONS

#### 1. Core Mission
- **Enhance Visual Clarity:** Convert vague descriptions into specific, detailed visual elements that DALL-E can accurately interpret.
- **Inject Strategic Details:** Add lighting, composition, materials, and artistic style without overwhelming the original concept.
- **Optimize for AI:** Include proven DALL-E performance keywords and technical qualifiers that improve output quality.
- **Preserve Intent:** Maintain the user's creative vision while strategically enhancing it for better results.

#### 2. The "${CONSTANTS.INSUFFICIENT_DETAIL_KEY}" Rule
If the user's input is too vague or minimal to optimize meaningfully (e.g., "cat", "car"), you MUST respond with the exact string \`${CONSTANTS.INSUFFICIENT_DETAIL_KEY}\`.

---

### OPTIMIZATION FRAMEWORK

**Structure:** [Main Subject] + [Key Visual Details] + [Style/Medium] + [Quality Enhancers]

**Essential Elements:**
- Specific colors, lighting, and composition
- Artistic style or medium when beneficial
- Technical quality descriptors: "detailed", "high resolution", "professional"
- Power words that maximize visual impact per token

---

### --- GOLDEN EXAMPLES ---

1. **User Input:** "A dog playing in a park"
   **Optimized Output:** "Golden retriever playing fetch in sunny park, green grass, natural lighting, shallow depth of field, detailed, photorealistic"

2. **User Input:** "Futuristic city"
   **Optimized Output:** "Futuristic cyberpunk city skyline, neon lights, glass towers, purple and blue lighting, night scene, detailed digital art, high resolution"

3. **User Input:** "Woman portrait"
   **Optimized Output:** "Professional portrait of woman, soft natural lighting, warm tones, studio photography, detailed, high resolution, elegant composition"

4. **User Input:** "Car"
   **Optimized Output:** "${CONSTANTS.INSUFFICIENT_DETAIL_KEY}"

---

User Prompt: {rawPrompt}
Optimized Prompt:
`;

interface GenerateImageRequestBody {
  rawPrompt: string;
  source?: "custom" | "suggestion";
}

type ContentType = "image/webp" | "image/jpeg" | "image/png";

const capitalizeFirstChar = (text: string | null | undefined): string => {
  if (!text || text.length === 0) return "";
  if (text === CONSTANTS.INSUFFICIENT_DETAIL_KEY) return text;
  return text.charAt(0).toUpperCase() + text.slice(1);
};

async function getOptimizedPrompt(
  rawPrompt: string,
  source: GenerateImageRequestBody["source"],
  context: InvocationContext,
): Promise<string> {
  if (source !== "custom") {
    context.log("➡️ Skipping optimization for AI-suggested prompt");
    return rawPrompt;
  }

  context.log("🚀 Optimizing user prompt...");

  const chatCompletion = await openai.chat.completions.create({
    model: CONSTANTS.OPENAI_GPT_MODEL,
    messages: [
      {
        role: "system",
        content: UserPromptOptimizerPrompt.replace("{rawPrompt}", rawPrompt),
      },
    ],
    max_completion_tokens: CONSTANTS.MAX_COMPLETION_TOKENS,
    temperature: CONSTANTS.TEMPERATURE,
  });

  const rawOptimizedPrompt =
    chatCompletion.choices[0].message.content?.trim() ?? "";

  const optimizedPrompt = capitalizeFirstChar(rawOptimizedPrompt);

  if (optimizedPrompt === CONSTANTS.INSUFFICIENT_DETAIL_KEY) {
    context.log(
      `❌ Prompt deemed insufficient for optimization: "${rawPrompt}"`,
    );

    throw new Error(`${CONSTANTS.INSUFFICIENT_DETAIL_KEY}`);
  }

  context.log(`✨ Optimized prompt: ${optimizedPrompt}`);
  return optimizedPrompt;
}

async function uploadImagesToAzure(
  processedImages: ProcessedImage[],
  originalBuffer: Buffer,
  baseImageFileName: string,
  context: InvocationContext,
): Promise<void> {
  const mimeTypeMap: Record<string, ContentType> = {
    webp: "image/webp",
    jpeg: "image/jpeg",
    png: "image/png",
  };

  const processedImageUploadPromises = processedImages.map((image) => {
    const blockBlobClient = containerClient.getBlockBlobClient(image.filename);
    const contentType = mimeTypeMap[image.size.format] ?? "image/png";

    context.log(
      `  - Queuing upload for ${image.filename} (${(
        image.buffer.length / 1024
      ).toFixed(1)}KB)`,
    );

    return blockBlobClient.uploadData(image.buffer, {
      blobHTTPHeaders: {
        blobContentType: contentType,
        blobCacheControl: CONSTANTS.CACHE_CONTROL_HEADER,
      },
    });
  });

  const originalImageUploadPromise = (async () => {
    const blockBlobClient =
      containerClient.getBlockBlobClient(baseImageFileName);

    context.log(`  - Queuing upload for original image: ${baseImageFileName}`);

    await blockBlobClient.uploadData(originalBuffer, {
      blobHTTPHeaders: {
        blobContentType: "image/png",
        blobCacheControl: CONSTANTS.CACHE_CONTROL_HEADER,
      },
    });
  })();

  await Promise.all([
    ...processedImageUploadPromises,
    originalImageUploadPromise,
  ]);

  context.log(
    `🎉 All ${
      processedImages.length + 1
    } images have been uploaded successfully!`,
  );
}

export async function createImage(
  request: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponseInit> {
  const rateLimitResponse = await applyRateLimiter(rateLimiter, request);
  if (rateLimitResponse) return rateLimitResponse;

  const { isAtLimit, ttl } = await checkUsageStatus(request);

  if (isAtLimit) {
    context.log("❌ User has exceeded daily usage limit");

    const errorMessage =
      ttl !== null && ttl < CONSTANTS.SIX_HOURS_IN_SECONDS
        ? "Your credits are due to reset shortly. Please try again in a little while."
        : "You have utilized all the free credits. Feel free to come back tomorrow same time.";

    return { status: 429, jsonBody: { error: errorMessage } };
  }

  try {
    const { rawPrompt, source } =
      (await request.json()) as GenerateImageRequestBody;

    context.log(`Received prompt: "${rawPrompt}" from source: "${source}"`);

    const optimizedPrompt = await getOptimizedPrompt(
      rawPrompt,
      source,
      context,
    );

    context.log("🎨 Generating image with DALL-E...");

    const response = await openai.images.generate({
      model: CONSTANTS.OPENAI_IMAGE_MODEL,
      prompt: optimizedPrompt,
      n: 1,
      size: CONSTANTS.IMAGE_SIZE,
    });

    const imageUrl = response.data?.[0]?.url;

    if (!imageUrl) {
      throw new Error("Image URL not returned from OpenAI");
    }

    /* 
      Increment usage counter AFTER successful generation
    */
    await incrementUsageCounter(request);

    context.log("📥 Downloading image from OpenAI...");

    const imageResponse = await axios.get(imageUrl, {
      responseType: "arraybuffer",
    });

    const originalBuffer = Buffer.from(imageResponse.data);

    context.log(
      `📊 Original image size: ${(originalBuffer.length / 1024 / 1024).toFixed(
        2,
      )}MB`,
    );

    const timestamp = new Date().getTime();
    const baseImageFileName = `${optimizedPrompt}_${timestamp}.png`;

    context.log("🔧 Processing image into multiple sizes...");

    let processedImages: ProcessedImage[] = [];

    try {
      processedImages = await ImageProcessor.processImage(
        originalBuffer,
        baseImageFileName,
      );

      context.log(`📸 Generated ${processedImages.length} different sizes`);

      await uploadImagesToAzure(
        processedImages,
        originalBuffer,
        baseImageFileName,
        context,
      );

      // invalidate image cache
      await redis.del(CONSTANTS.IMAGE_CACHE_KEY);
      context.log("✅ Invalidated image cache");

      return {
        jsonBody: {
          filename: baseImageFileName,
          sizes: processedImages.map((img) => img.filename),
          originalSize: `${(originalBuffer.length / 1024 / 1024).toFixed(2)}MB`,
          processedSizes: processedImages.map((img) => ({
            filename: img.filename,
            size: `${(img.buffer.length / 1024).toFixed(1)}KB`,
            dimensions: `${img.originalWidth}x${img.originalHeight}`,
            suffix: img.size.suffix,
          })),
        },
      };
    } catch (processingError) {
      context.error("❌ Error processing image:", processingError);
      context.log("⚠️ Falling back to uploading original image only...");

      const blockBlobClient =
        containerClient.getBlockBlobClient(baseImageFileName);

      await blockBlobClient.uploadData(originalBuffer, {
        blobHTTPHeaders: { blobContentType: "image/png" },
      });

      // invalidate image cache
      await redis.del(CONSTANTS.IMAGE_CACHE_KEY);
      context.log("✅ Invalidated image cache (fallback)");

      context.log("📤 Original image uploaded as fallback");

      return {
        jsonBody: {
          filename: baseImageFileName,
          sizes: [baseImageFileName],
          fallback: true,
          error: "Image processing failed; used original.",
        },
      };
    }
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === `${CONSTANTS.INSUFFICIENT_DETAIL_KEY}`
    ) {
      return {
        status: 400,
        jsonBody: {
          error: "Your prompt is too vague. Please provide more detail.",
        },
      };
    }

    context.error(
      "❌ An unexpected error occurred in createImage function:",
      error,
    );

    return {
      status: 500,
      jsonBody: { error: "An internal server error occurred." },
    };
  }
}

app.http("create-image", {
  methods: ["POST"],
  authLevel: "anonymous",
  handler: createImage,
});
