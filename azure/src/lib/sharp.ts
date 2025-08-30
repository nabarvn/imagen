import sharp from "sharp";

export interface ImageSize {
  width: number;
  suffix: string;
  quality: number;
  format: "webp" | "png" | "jpeg";
}

export const IMAGE_SIZES: ImageSize[] = [
  { width: 400, suffix: "_small", quality: 80, format: "webp" }, // ~30-50KB - Mobile
  { width: 800, suffix: "_medium", quality: 85, format: "webp" }, // ~80-150KB - Tablet
  { width: 1200, suffix: "_large", quality: 85, format: "webp" }, // ~150-300KB - Desktop
  { width: 1920, suffix: "_xlarge", quality: 90, format: "webp" }, // ~300-600KB - Large displays
];

export interface ProcessedImage {
  buffer: Buffer;
  filename: string;
  size: ImageSize;
  originalWidth: number;
  originalHeight: number;
}

export class ImageProcessor {
  /*
    Process a single image into multiple sizes
  */
  static async processImage(
    imageBuffer: Buffer,
    baseFilename: string,
  ): Promise<ProcessedImage[]> {
    const results: ProcessedImage[] = [];

    try {
      const metadata = await sharp(imageBuffer).metadata();

      const originalWidth = metadata.width || 1024;
      const originalHeight = metadata.height || 1024;

      console.log(`📐 Processing image: ${originalWidth}x${originalHeight}`);

      for (const sizeConfig of IMAGE_SIZES) {
        try {
          // calculate dimensions maintaining aspect ratio
          const aspectRatio = originalWidth / originalHeight;

          let targetWidth = sizeConfig.width;
          let targetHeight = Math.round(targetWidth / aspectRatio);

          // use original size if original is smaller
          if (targetWidth > originalWidth) {
            targetWidth = originalWidth;
            targetHeight = originalHeight;
          }

          console.log(
            `🔄 Creating ${sizeConfig.suffix}: ${targetWidth}x${targetHeight} (${sizeConfig.format})`,
          );

          // process the image
          let sharpInstance = sharp(imageBuffer).resize(
            targetWidth,
            targetHeight,
            {
              fit: "cover",
              position: "center",
            },
          );

          let processedBuffer: Buffer;

          const extension = sizeConfig.format;

          // format-specific optimizations
          switch (sizeConfig.format) {
            case "webp":
              processedBuffer = await sharpInstance
                .webp({
                  quality: sizeConfig.quality,
                  effort: 6,
                  smartSubsample: true,
                })
                .toBuffer();
              break;

            case "jpeg":
              processedBuffer = await sharpInstance
                .jpeg({
                  quality: sizeConfig.quality,
                  progressive: true,
                  mozjpeg: true,
                })
                .toBuffer();
              break;

            case "png":
              processedBuffer = await sharpInstance
                .png({
                  quality: sizeConfig.quality,
                  compressionLevel: 9,
                  progressive: true,
                })
                .toBuffer();
              break;

            default:
              throw new Error(`Unsupported format: ${sizeConfig.format}`);
          }

          const filename = baseFilename.replace(
            /\.[^/.]+$/,
            `${sizeConfig.suffix}.${extension}`,
          );

          console.log(
            `✅ Created ${filename}: ${(processedBuffer.length / 1024).toFixed(
              1,
            )}KB`,
          );

          results.push({
            buffer: processedBuffer,
            filename,
            size: sizeConfig,
            originalWidth: targetWidth,
            originalHeight: targetHeight,
          });
        } catch (error) {
          console.error(
            `❌ Failed to process size ${sizeConfig.suffix}:`,
            error,
          );

          // continue with other sizes even if one fails
        }
      }

      console.log(
        `🎉 Successfully processed ${results.length}/${IMAGE_SIZES.length} sizes`,
      );

      return results;
    } catch (error) {
      console.error("❌ Failed to process image:", error);
      throw error;
    }
  }
}
