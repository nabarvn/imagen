"use client";

import Image from "next/image";
import { useMediaPerformance } from "@/hooks";
import { useState, useEffect, useRef, SyntheticEvent } from "react";

import {
  getBestImageSize,
  getFallbackImageUrl,
  AvailableSize,
} from "@/lib/media";

type SmartImageProps = {
  imageKey: number;
  imageName: string;
  imageUrl: string;
  availableSizes?: AvailableSize[];
  staggerDelay?: number;
};

const ProgressiveDots = () => {
  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center bg-gradient-to-br from-violet-50/80 to-indigo-50/80 backdrop-blur-sm">
      <div
        className="absolute inset-0 animate-pulse bg-gradient-to-br from-violet-100/40 to-indigo-100/40"
        style={{ animationDuration: "2.5s" }}
      />

      <div className="relative z-10 flex space-x-2">
        {[0, 1, 2, 3, 4].map((index) => (
          <div
            key={index}
            className="h-2.5 w-2.5 animate-pulse rounded-full bg-violet-500 shadow-lg"
            style={{
              animationDelay: `${index * 0.15}s`,
              animationDuration: "1.2s",
            }}
          />
        ))}
      </div>

      <div className="z-5 absolute inset-0 flex items-center justify-center opacity-40">
        <div className="flex space-x-3">
          {[0, 1, 2].map((index) => (
            <div
              key={`secondary-${index}`}
              className="h-1.5 w-1.5 animate-bounce rounded-full bg-indigo-500 shadow-md"
              style={{
                animationDelay: `${index * 0.25 + 0.3}s`,
                animationDuration: "1.8s",
              }}
            />
          ))}
        </div>
      </div>

      <div
        className="absolute inset-0 z-0 animate-pulse bg-gradient-to-r from-transparent via-violet-200/30 to-transparent"
        style={{ animationDuration: "3.5s", animationDirection: "alternate" }}
      />
    </div>
  );
};

const SmartImage = ({
  imageKey,
  imageName,
  imageUrl,
  availableSizes = [],
  staggerDelay = 0,
}: SmartImageProps) => {
  const [isLoading, setLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [shouldStartLoading, setShouldStartLoading] = useState(false);
  const [currentImageUrl, setCurrentImageUrl] = useState<string>("");
  const [currentSuffix, setCurrentSuffix] = useState<string>("");

  const retryCountRef = useRef(0);
  const maxRetries = 3;

  const { startImageLoad, endImageLoad } = useMediaPerformance();

  useEffect(() => {
    if (availableSizes && availableSizes.length > 0) {
      const bestUrl = getBestImageSize(availableSizes);
      const bestSize = availableSizes.find((size) => size.url === bestUrl);

      setCurrentImageUrl(bestUrl);
      setCurrentSuffix(bestSize?.suffix ?? "_unknown");
    } else {
      setCurrentImageUrl(imageUrl);
      setCurrentSuffix("_original");

      console.warn(
        `⚠️ Image ${imageKey}: No optimized sizes available, using original URL`,
      );
    }
  }, [availableSizes, imageUrl, imageKey]);

  useEffect(() => {
    if (staggerDelay > 0) {
      const isPageVisible = !document.hidden;
      const actualDelay = isPageVisible ? staggerDelay : 0;

      const timer = setTimeout(() => {
        setShouldStartLoading(true);
      }, actualDelay);

      return () => clearTimeout(timer);
    } else {
      setShouldStartLoading(true);
    }
  }, [staggerDelay, imageKey]);

  const handleError = () => {
    console.warn(
      `🚫 Image failed to load (attempt ${
        retryCountRef.current + 1
      }/${maxRetries}):`,
      currentImageUrl.substring(0, 100) + "...",
    );

    if (retryCountRef.current < maxRetries) {
      retryCountRef.current += 1;

      if (
        retryCountRef.current === 1 &&
        availableSizes &&
        availableSizes.length > 1
      ) {
        const fallbackUrl = getFallbackImageUrl(availableSizes, currentSuffix);

        if (fallbackUrl && fallbackUrl !== currentImageUrl) {
          setCurrentImageUrl(fallbackUrl);

          const fallbackSize = availableSizes.find(
            (size) => size.url === fallbackUrl,
          );

          setCurrentSuffix(fallbackSize?.suffix ?? "_fallback");

          setHasError(false);
          setLoading(true);

          return;
        }
      }

      setTimeout(() => {
        setHasError(false);
        setLoading(true);
      }, 1000 * retryCountRef.current);
    } else {
      console.error(
        `❌ Image failed to load after ${maxRetries} attempts:`,
        currentImageUrl.substring(0, 100) + "...",
      );

      setHasError(true);
      setLoading(false);
    }
  };

  const handleLoadingComplete = (event: SyntheticEvent<HTMLImageElement>) => {
    setLoading(false);
    setHasError(false);

    retryCountRef.current = 0;

    endImageLoad(
      currentImageUrl,
      event.currentTarget.naturalWidth,
      event.currentTarget.naturalHeight,
    );
  };

  useEffect(() => {
    if (shouldStartLoading && !hasError && currentImageUrl) {
      startImageLoad(currentImageUrl);
    }
  }, [shouldStartLoading, hasError, currentImageUrl, startImageLoad]);

  /* 
    Listen for page visibility changes to restart stalled loads
  */
  useEffect(() => {
    const handleVisibilityChange = () => {
      const isVisible = !document.hidden;

      if (isVisible && !shouldStartLoading && staggerDelay > 0) {
        setShouldStartLoading(true);
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () =>
      document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [imageKey, shouldStartLoading, staggerDelay]);

  if (hasError) {
    return (
      <div className="z-10 flex h-full w-full items-center justify-center bg-gray-100 text-sm text-gray-500">
        <div className="p-4 text-center">
          <p>Failed to load image</p>

          <button
            onClick={() => {
              retryCountRef.current = 0;
              setHasError(false);
              setLoading(true);
            }}
            className="mt-2 rounded-sm bg-violet-500 px-3 py-1 text-xs text-white hover:bg-violet-600"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // show simple waiting state during stagger delay
  if (!shouldStartLoading || !currentImageUrl) {
    return (
      <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-violet-50/20 to-indigo-50/20" />
    );
  }

  return (
    <div
      className={`absolute inset-0 ${isLoading ? "animate-pulse" : ""}`}
      style={isLoading ? { animationDuration: "4s" } : {}}
    >
      <Image
        fill
        priority={imageKey < 5 ? true : false}
        loading={imageKey < 5 ? "eager" : "lazy"}
        src={currentImageUrl ?? imageUrl}
        alt={`${imageName.split("_").shift()?.toString().split(".").shift()}`}
        placeholder="empty"
        sizes={
          imageKey === 0
            ? "(min-width: 1536px) 40vw, (min-width: 1280px) 50vw, (min-width: 1024px) 66vw, (min-width: 768px) 100vw, 100vw"
            : "(min-width: 1536px) 20vw, (min-width: 1280px) 25vw, (min-width: 1024px) 33vw, (min-width: 768px) 50vw, 100vw"
        }
        className={`transform transition-all duration-700 ease-out ${
          isLoading
            ? "scale-105 opacity-10 blur-lg"
            : "scale-100 opacity-100 blur-0"
        } w-full`}
        onLoad={handleLoadingComplete}
        onError={handleError}
        quality={75}
        unoptimized={true}
      />

      {isLoading && <ProgressiveDots />}
    </div>
  );
};

export default SmartImage;
