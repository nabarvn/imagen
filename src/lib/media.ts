export interface AvailableSize {
  filename: string;
  suffix: string;
  url: string;
}

/*
  Image size configuration matching the Azure function
*/
export const IMAGE_SIZES: ImageSize[] = [
  { width: 400, suffix: "_small", quality: 80, format: "webp" }, // ~30-50KB - Mobile
  { width: 800, suffix: "_medium", quality: 85, format: "webp" }, // ~80-150KB - Tablet
  { width: 1200, suffix: "_large", quality: 85, format: "webp" }, // ~150-300KB - Desktop
  { width: 1920, suffix: "_xlarge", quality: 90, format: "webp" }, // ~300-600KB - Large displays
];

interface ImageSize {
  width: number;
  suffix: string;
  quality: number;
  format: "webp" | "png" | "jpeg";
}

/*
  Get screen width from window or use a reasonable default
*/
export const getScreenWidth = (): number => {
  if (typeof window === "undefined") return 1024; // SSR default
  return window.innerWidth ?? 1024;
};

/*
  Get the best image size for a given screen width
*/
export const getBestImageSize = (
  availableSizes: AvailableSize[],
  screenWidth?: number,
): string => {
  if (!availableSizes || availableSizes.length === 0) {
    console.warn("⚠️ No available sizes provided");
    return "";
  }

  const width = screenWidth ?? getScreenWidth();

  let idealSuffix: string;

  if (width <= 480) {
    idealSuffix = "_small"; // Mobile (400px image)
  } else if (width <= 768) {
    idealSuffix = "_medium"; // Tablet (800px image)
  } else if (width <= 1600) {
    idealSuffix = "_large"; // Desktop - covers 1366px, 1440px, 1536px screens (1200px image)
  } else {
    idealSuffix = "_xlarge"; // Large displays - 4K monitors, ultra-wide (1920px image)
  }

  let bestSize = availableSizes.find((size) => size.suffix === idealSuffix);

  // fallback strategy
  if (!bestSize) {
    const fallbackOrder = [
      "_medium",
      "_large",
      "_small",
      "_xlarge",
      "_original",
    ];

    for (const fallbackSuffix of fallbackOrder) {
      bestSize = availableSizes.find((size) => size.suffix === fallbackSuffix);
      if (bestSize) break;
    }
  }

  // last resort
  if (!bestSize) {
    bestSize = availableSizes[0];
  }

  return bestSize.url;
};

/*
  Get a fallback image URL in case the best size fails to load
*/
export const getFallbackImageUrl = (
  availableSizes: AvailableSize[],
  currentSuffix: string,
): string => {
  const alternatives = availableSizes.filter(
    (size) => size.suffix !== currentSuffix,
  );

  if (alternatives.length === 0) return "";

  const fallback =
    alternatives.find((size) => size.suffix === "_medium") ?? alternatives[0];

  return fallback.url;
};
