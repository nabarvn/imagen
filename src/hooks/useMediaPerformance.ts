"use client";

import { useCallback, useRef } from "react";

interface PerformanceMetrics {
  imageUrl: string;
  loadStartTime: number;
  loadEndTime?: number;
  loadDuration?: number;
  imageSize?: {
    width: number;
    height: number;
  };
}

export const useMediaPerformance = () => {
  const metricsRef = useRef<Map<string, PerformanceMetrics>>(new Map());

  const startImageLoad = useCallback((imageUrl: string) => {
    metricsRef.current.set(imageUrl, {
      imageUrl,
      loadStartTime: performance.now(),
    });
  }, []);

  const endImageLoad = useCallback(
    (imageUrl: string, naturalWidth?: number, naturalHeight?: number) => {
      const metric = metricsRef.current.get(imageUrl);

      if (metric) {
        const loadEndTime = performance.now();

        const updatedMetric: PerformanceMetrics = {
          ...metric,
          loadEndTime,
          loadDuration: loadEndTime - metric.loadStartTime,
          imageSize:
            naturalWidth && naturalHeight
              ? { width: naturalWidth, height: naturalHeight }
              : undefined,
        };

        metricsRef.current.set(imageUrl, updatedMetric);

        if (process.env.NODE_ENV === "development") {
          const duration = updatedMetric.loadDuration ?? 0;

          const isSlowLoad = duration > 10000;
          const isVerySlowLoad = duration > 60000;

          if (isVerySlowLoad) {
            console.warn(
              `😱 EXTREMELY SLOW load in ${duration.toFixed(0)}ms (${(
                duration / 1000
              ).toFixed(1)}s):`,
              {
                url: imageUrl.substring(0, 100) + "...",
                size: updatedMetric.imageSize,
                possibleCause:
                  "Likely background tab throttling - check if tab was hidden during load",
              },
            );
          } else if (isSlowLoad) {
            console.log(
              `🐌 Slow load in ${duration.toFixed(0)}ms (${(
                duration / 1000
              ).toFixed(1)}s):`,
              {
                url: imageUrl.substring(0, 100) + "...",
                size: updatedMetric.imageSize,
                note: "Normal for larger images from Azure Storage without CDN",
              },
            );
          } else {
            console.log(`🏎️ Image loaded in ${duration.toFixed(0)}ms:`, {
              url: imageUrl.substring(0, 100) + "...",
              size: updatedMetric.imageSize,
            });
          }
        }
      }
    },
    [],
  );

  const getMetrics = useCallback(() => {
    return Array.from(metricsRef.current.values());
  }, []);

  const getAverageLoadTime = useCallback(() => {
    const metrics = Array.from(metricsRef.current.values()).filter(
      (m) => m.loadDuration !== undefined,
    );

    if (metrics.length === 0) return 0;

    const total = metrics.reduce((sum, m) => sum + (m.loadDuration ?? 0), 0);

    return total / metrics.length;
  }, []);

  const clearMetrics = useCallback(() => {
    metricsRef.current.clear();
  }, []);

  return {
    startImageLoad,
    endImageLoad,
    getMetrics,
    getAverageLoadTime,
    clearMetrics,
  };
};
