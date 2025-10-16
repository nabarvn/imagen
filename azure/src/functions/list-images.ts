import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";

import { redis } from "../lib/redis";
import { IMAGE_SIZES } from "../lib/sharp";
import { getSASToken } from "../lib/sas-token";
import { containerClient } from "../lib/storage";
import { applyRateLimiter, rateLimiter } from "../lib/rate-limiter";

const CONSTANTS = {
  DEFAULT_PAGE_LIMIT: 9,
  ORIGINAL_IMAGE_SUFFIX: "_original",
  DEFAULT_URL_PREFERENCE: ["_medium", "_large", "_small"],
  IMAGE_CACHE_KEY: "images:all",
};

interface PaginationParams {
  page: number;
  limit: number;
}

interface ImageVariant {
  filename: string;
  suffix: string;
  url: string;
}

interface BlobGroup {
  baseName: string;
  timestamp: number;
  variants: ImageVariant[];
}

interface ClientImage {
  name: string;
  url?: string;
  availableSizes: ImageVariant[];
  timestamp: number;
}

interface CachedImageData {
  allImages: ClientImage[];
  totalBlobs: number;
}

function getPaginationParams(request: HttpRequest): PaginationParams {
  const url = new URL(request.url);
  const page = parseInt(url.searchParams.get("page") || "1");

  const limit = parseInt(
    url.searchParams.get("limit") || CONSTANTS.DEFAULT_PAGE_LIMIT.toString(),
  );

  return { page, limit };
}

function findImageSize(filename: string): { baseName: string; suffix: string } {
  // check if this is a processed size variant
  const sizeMatch = IMAGE_SIZES.find((size) => filename.includes(size.suffix));

  if (sizeMatch) {
    return {
      baseName: filename
        .replace(sizeMatch.suffix, "")
        .replace(/\.(webp|png|jpeg|jpg)$/, ".png"),
      suffix: sizeMatch.suffix,
    };
  }

  return { baseName: filename, suffix: CONSTANTS.ORIGINAL_IMAGE_SUFFIX };
}

function determineDefaultUrl(variants: ImageVariant[]): string | undefined {
  for (const suffix of CONSTANTS.DEFAULT_URL_PREFERENCE) {
    const variant = variants.find((v) => v.suffix === suffix);
    if (variant) return variant.url;
  }

  /* 
    Fallback to the first available variant if no preferred size is found
  */
  return variants[0]?.url;
}

async function groupAndTransformBlobs(
  context: InvocationContext,
  sasToken: string,
): Promise<{ allImages: ClientImage[]; totalBlobs: number }> {
  const accountName = process.env.STORAGE_ACCOUNT_NAME;

  if (!accountName) {
    throw new Error("STORAGE_ACCOUNT_NAME environment variable is not set");
  }

  const blobGroups = new Map<string, BlobGroup>();

  let blobCount = 0;

  for await (const blob of containerClient.listBlobsFlat()) {
    blobCount++;

    const { baseName, suffix } = findImageSize(blob.name);
    const timestampMatch = baseName.match(/_(\d+)\.png$/);
    const timestamp = timestampMatch ? parseInt(timestampMatch[1], 10) : 0;

    const group = blobGroups.get(baseName) ?? {
      baseName,
      timestamp,
      variants: [],
    };

    group.variants.push({
      filename: blob.name,
      suffix,
      url: `https://${accountName}.blob.core.windows.net/images/${blob.name}?${sasToken}`,
    });

    blobGroups.set(baseName, group);
  }

  context.log(
    `Grouped ${blobCount} blobs into ${blobGroups.size} unique images`,
  );

  const allImages = Array.from(blobGroups.values()).map((group) => {
    const hasProcessedSizes = group.variants.some(
      (v) => v.suffix !== CONSTANTS.ORIGINAL_IMAGE_SUFFIX,
    );

    const availableSizes = hasProcessedSizes
      ? group.variants.filter(
          (v) => v.suffix !== CONSTANTS.ORIGINAL_IMAGE_SUFFIX,
        )
      : group.variants;

    return {
      name: group.baseName,
      url: determineDefaultUrl(availableSizes),
      availableSizes,
      timestamp: group.timestamp,
    };
  });

  // sort by timestamp (newest first)
  allImages.sort((a, b) => b.timestamp - a.timestamp);

  return { allImages, totalBlobs: blobCount };
}

export async function listImages(
  request: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponseInit> {
  const rateLimitResponse = await applyRateLimiter(rateLimiter, request);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const { page, limit } = getPaginationParams(request);

    let allImages: ClientImage[] = [];
    let totalBlobs = 0;

    const cachedImagesData = await redis.get(CONSTANTS.IMAGE_CACHE_KEY);

    if (typeof cachedImagesData === "string") {
      context.log("✅ Cache hit for image list");
      const parsedData: CachedImageData = JSON.parse(cachedImagesData);

      allImages = parsedData.allImages;
      totalBlobs = parsedData.totalBlobs;
    } else {
      context.log("⏳ Cache miss for image list; fetching from storage");

      const sasToken = await getSASToken();
      const transformedBlobs = await groupAndTransformBlobs(context, sasToken);

      allImages = transformedBlobs.allImages;
      totalBlobs = transformedBlobs.totalBlobs;

      // cache the full, sorted list of images and the blob count
      const dataToCache: CachedImageData = { allImages, totalBlobs };
      await redis.set(CONSTANTS.IMAGE_CACHE_KEY, JSON.stringify(dataToCache));
    }

    // apply pagination
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedImages = allImages.slice(startIndex, endIndex);
    const hasMore = endIndex < allImages.length;
    const totalImages = allImages.length;

    context.log(
      `Returning ${paginatedImages.length} of ${totalImages} images for page ${page}`,
    );

    // gather metadata and statistics
    const sizeStats = paginatedImages.reduce(
      (stats, img) => {
        img.availableSizes.forEach((size) => {
          stats[size.suffix] = (stats[size.suffix] || 0) + 1;
        });

        return stats;
      },
      {} as Record<string, number>,
    );

    context.log(`📊 Available sizes in this batch:`, sizeStats);

    return {
      jsonBody: {
        images: paginatedImages,
        pagination: {
          page,
          limit,
          hasMore,
          totalImages,
          totalPages: Math.ceil(totalImages / limit),
        },
        metadata: {
          availableSizesConfig: IMAGE_SIZES,
          sizeStats,
          totalBlobs,
        },
      },
    };
  } catch (error) {
    context.error(
      "❌ An unexpected error occurred in listImages function:",
      error,
    );

    return {
      status: 500,
      jsonBody: { error: "An internal server error occurred." },
    };
  }
}

app.http("list-images", {
  methods: ["GET"],
  authLevel: "anonymous",
  handler: listImages,
});
