import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";

import { openai } from "../lib/openai";
import { applyRateLimiter, rateLimiter } from "../lib/rate-limiter";

const CONSTANTS = {
  OPENAI_MODEL: "gpt-4.1-nano",
  MAX_COMPLETION_TOKENS: 50,
  TEMPERATURE: 0.9,
  ARTISTIC_STYLES: [
    "Anime highly exaggerated",
    "South Park",
    "Simpsons",
    "Studio Ghibli",
    "Hi-res Minecraft",
    "Lego art",
    "3D voxel art",
    "Watercolor",
    "Marionette",
    "Rubber hose animation",
    "Pixar",
    "ASCII",
    "Black and white",
    "Oil painting",
    "Van Gogh",
    "32-bit isometric",
    "Art nouveau",
    "Diagramatic drawing",
    "Crayon drawing",
    "SynthWave",
    "Pop-art cartoon",
    "Stained glass window",
    "Charley Harper",
    "Vintage polaroid",
    "1990s manga",
    "1990s point and click 16-bit adventure game",
  ],
};

const capitalizeFirstChar = (text: string): string => {
  if (text.length === 0) return "";
  return text.charAt(0).toUpperCase() + text.slice(1);
};

const createPromptSuggestionSystemPrompt = (style: string): string => `
You are an Expert AI Art Director and Creative Prompt Generator. Your primary objective is to create ONE visually striking, diverse DALL-E prompt suggestion that combines unexpected style-subject pairings with technical optimization.

---

### MASTER INSTRUCTIONS

#### 1. Core Mission
- **Mandatory Style Selection:** You MUST use this specific artistic style -> "${style}"
- **Creative Subject Generation:** Select from diverse categories -> portraits, landscapes, animals, fantasy creatures, sci-fi concepts, historical scenes, everyday objects, abstract art, cultural elements
- **Unconventional Pairing:** Create surprising combinations users wouldn't expect (e.g., "ancient Roman senator in Lego art style" or "cyberpunk cat in watercolor style")

#### 2. Technical Optimization
- Keep under ${CONSTANTS.MAX_COMPLETION_TOKENS} tokens
- Include specific visual details: lighting, colors, composition, mood
- Add quality enhancers: "detailed", "vibrant", "cinematic", "professional", "high resolution"
- Ensure diverse representation when featuring people

#### 3. Creativity Rules
- Avoid cliché combinations
- Mix complexity levels randomly (simple subjects vs elaborate scenes)
- Include unexpected elements that spark curiosity
- Focus on concepts that produce visually striking, shareable results

---

### CRITICAL OUTPUT INSTRUCTION
Return ONLY the raw prompt text with NO prefixes, labels, quotes, or commentary whatsoever.
`;

async function generatePromptSuggestion(
  context: InvocationContext,
): Promise<string> {
  const randomStyleIndex = Math.floor(
    Math.random() * CONSTANTS.ARTISTIC_STYLES.length,
  );

  const selectedStyle = CONSTANTS.ARTISTIC_STYLES[randomStyleIndex];

  context.log(
    `🎨 Selected artistic style for suggestion: "${selectedStyle}" (index: ${randomStyleIndex})`,
  );

  const systemPrompt = createPromptSuggestionSystemPrompt(selectedStyle);

  const response = await openai.chat.completions.create({
    model: CONSTANTS.OPENAI_MODEL,
    messages: [{ role: "system", content: systemPrompt }],
    max_tokens: CONSTANTS.MAX_COMPLETION_TOKENS,
    temperature: CONSTANTS.TEMPERATURE,
  });

  const suggestionText = response.choices[0]?.message?.content?.trim() ?? "";

  if (!suggestionText) {
    throw new Error("OpenAI returned an empty suggestion");
  }

  return capitalizeFirstChar(suggestionText);
}

export async function generateSuggestion(
  request: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponseInit> {
  const rateLimitResponse = await applyRateLimiter(rateLimiter, request);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const suggestion = await generatePromptSuggestion(context);
    context.log(`✨ Generated prompt suggestion: "${suggestion}"`);

    return {
      jsonBody: { suggestion },
    };
  } catch (error) {
    context.error(
      "❌ An unexpected error occurred in generateSuggestion:",
      error,
    );

    return {
      status: 500,
      jsonBody: {
        error: "Failed to generate a prompt suggestion at this time.",
      },
    };
  }
}

app.http("generate-suggestion", {
  methods: ["GET"],
  authLevel: "anonymous",
  handler: generateSuggestion,
});
