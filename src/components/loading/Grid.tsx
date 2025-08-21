"use client";

import Image from "./Image";

const Grid = () => {
  const skeletonItems = Array.from({ length: 9 }, (_, index) => ({
    id: index,
    isFirst: index === 0,
    delay: index * 100, // staggered animation
  }));

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      <div
        className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5"
        role="img"
        aria-label="Loading image gallery"
      >
        {skeletonItems.map((item) => (
          <Image
            key={`skeleton-${item.id}`}
            isFirst={item.isFirst}
            delay={item.delay}
          />
        ))}
      </div>
    </div>
  );
};

export default Grid;
