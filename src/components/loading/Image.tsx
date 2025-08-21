"use client";

import { useEffect, useState } from "react";

type ImageProps = {
  isFirst: boolean;
  delay?: number;
};

const Image = ({ isFirst, delay = 0 }: ImageProps) => {
  const [shouldAnimate, setShouldAnimate] = useState(false);

  useEffect(() => {
    // respect reduced motion preferences
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    const timer = setTimeout(
      () => {
        setShouldAnimate(!prefersReducedMotion);
      },
      prefersReducedMotion ? 0 : delay,
    );

    return () => clearTimeout(timer);
  }, [delay]);

  return (
    <div
      className={`aspect-h-1 aspect-w-1 relative cursor-help xl:aspect-h-7 xl:aspect-w-7 ${
        isFirst && "md:col-span-2 md:row-span-2"
      } overflow-hidden rounded-sm shadow-lg transition-transform duration-200 ease-in-out`}
      role="img"
      aria-label="Loading image placeholder"
    >
      <div className="absolute inset-0 bg-gradient-to-br from-violet-50/60 to-indigo-50/60" />

      <div
        className={`absolute inset-0 translate-x-[-100%] transform ${
          shouldAnimate ? "animate-shimmer motion-safe:animate-shimmer" : ""
        }`}
        style={{
          background: `linear-gradient(
            90deg,
            transparent 0%,
            rgba(139, 92, 246, 0.1) 20%,
            rgba(139, 92, 246, 0.15) 50%,
            rgba(139, 92, 246, 0.1) 80%,
            transparent 100%
          )`,
          animationDuration: "2s",
          animationIterationCount: "infinite",
          animationTimingFunction: "ease-in-out",
          animationDelay: `${delay}ms`,
        }}
        aria-hidden="true"
      />

      <div
        className="absolute inset-0 bg-gradient-to-br from-violet-100/30 to-indigo-100/30 motion-safe:animate-pulse"
        style={{ animationDuration: "3s", animationDelay: `${delay * 0.5}ms` }}
        aria-hidden="true"
      />

      <div
        className="absolute inset-0 bg-gradient-to-br from-transparent via-transparent to-violet-200/20"
        aria-hidden="true"
      />
    </div>
  );
};

export default Image;
