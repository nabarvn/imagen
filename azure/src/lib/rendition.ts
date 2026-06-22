export interface ImageSize {
  width: number;
  suffix: string;
  quality: number;
  format: "webp" | "png" | "jpeg";
}

export interface ProcessedImage {
  buffer: Buffer;
  filename: string;
  size: ImageSize;
  originalWidth: number;
  originalHeight: number;
}

export const IMAGE_SIZES: ImageSize[] = [
  { width: 400, suffix: "_small", quality: 80, format: "webp" },
  { width: 800, suffix: "_medium", quality: 85, format: "webp" },
  { width: 1200, suffix: "_large", quality: 85, format: "webp" },
  { width: 1920, suffix: "_xlarge", quality: 90, format: "webp" },
];
