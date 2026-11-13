import { redis } from "./redis";

const IMAGE_LIST_CACHE_KEY = "images:all";
const IMAGE_LIST_VERSION_KEY = "images:version";
const IMAGE_LIST_CACHE_TTL_SECONDS = 5 * 60;

type ImageListCache<T> = {
  version: number;
  allImages: T[];
  totalBlobs: number;
};

function asVersion(value: unknown): number {
  const version = Number(value ?? 0);
  return Number.isFinite(version) ? version : 0;
}

export async function readImageListVersion(): Promise<number> {
  return asVersion(await redis.get(IMAGE_LIST_VERSION_KEY));
}

export async function readImageListCache<T>(
  version: number,
): Promise<{ allImages: T[]; totalBlobs: number } | null> {
  const cached = await redis.get<ImageListCache<T>>(IMAGE_LIST_CACHE_KEY);

  if (
    !cached ||
    typeof cached !== "object" ||
    cached.version !== version ||
    !Array.isArray(cached.allImages) ||
    typeof cached.totalBlobs !== "number"
  ) {
    return null;
  }

  return {
    allImages: cached.allImages,
    totalBlobs: cached.totalBlobs,
  };
}

export async function writeImageListCacheIfCurrent<T>(
  versionAtStart: number,
  allImages: T[],
  totalBlobs: number,
): Promise<boolean> {
  const versionNow = await readImageListVersion();
  if (versionNow !== versionAtStart) return false;

  const payload: ImageListCache<T> = {
    version: versionAtStart,
    allImages,
    totalBlobs,
  };

  await redis.set(IMAGE_LIST_CACHE_KEY, payload, {
    ex: IMAGE_LIST_CACHE_TTL_SECONDS,
  });

  return true;
}

export async function invalidateImageListCache(): Promise<void> {
  await redis.incr(IMAGE_LIST_VERSION_KEY);
  await redis.del(IMAGE_LIST_CACHE_KEY);
}
