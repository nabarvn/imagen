"use client";

import { getImages } from "@/lib";
import useSWR, { mutate } from "swr";
import { SmartImage } from "@/components";
import { useIntersection } from "@mantine/hooks";
import { LoadingGrid } from "@/components/loading";
import type { Image, ImagesData } from "@/typings";
import { useFingerprint } from "@/components/Fingerprint";
import { ArrowPathIcon } from "@heroicons/react/24/outline";
import { useEffect, useState, useCallback, useRef } from "react";

const Images = () => {
  const { fingerprint } = useFingerprint();

  const [hasMore, setHasMore] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [allImages, setAllImages] = useState<Image[]>([]);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isPrepending, setIsPrepending] = useState(false);

  const isLoadingRef = useRef(false);
  const prependedImagesCountRef = useRef(0);
  const imagesContainerRef = useRef<HTMLDivElement>(null);

  // keep refs in sync with state
  const currentPageRef = useRef(currentPage);
  currentPageRef.current = currentPage;
  const allImagesRef = useRef(allImages);
  allImagesRef.current = allImages;

  useEffect(() => {
    if (isPrepending && imagesContainerRef.current) {
      const elementTop =
        imagesContainerRef.current.getBoundingClientRect().top + window.scrollY;

      const offset = 115;

      window.scrollTo({
        top: elementTop - offset,
        behavior: "smooth",
      });

      setIsPrepending(false);
    }
  }, [isPrepending]);

  useEffect(() => {
    const handleNewImage = (event: Event) => {
      const customEvent = event as CustomEvent<Image>;
      const newImage = customEvent.detail;
      if (!newImage) return;

      const isDuplicate = allImages.some((img) => img.url === newImage.url);
      if (isDuplicate) return;

      setIsPrepending(true);
      prependedImagesCountRef.current += 1;

      // add to local state for optimistic update
      setAllImages((prev) => [newImage, ...prev]);

      mutate(
        "images-page-1",
        (currentData: ImagesData | undefined) => {
          if (
            !currentData ||
            currentData.images.find((img) => img.url === newImage.url)
          ) {
            return currentData;
          }

          return {
            ...currentData,
            images: [newImage, ...currentData.images],
            pagination: {
              ...currentData.pagination,
              totalImages: currentData.pagination.totalImages + 1,
            },
          };
        },
        { revalidate: false },
      );
    };

    document.addEventListener("new-image-generated", handleNewImage);

    return () =>
      document.removeEventListener("new-image-generated", handleNewImage);
  }, [allImages]);

  const limit = 9;

  // hook for fetching the initial page of images
  const { data: firstPageData, isLoading: isInitialLoading } =
    useSWR<ImagesData>(
      "images-page-1",
      () => getImages(fingerprint, 1, limit),
      { revalidateOnFocus: false },
    );

  /*
    Fetch subsequent pages and append them to the list
  */
  const loadMore = useCallback(async () => {
    if (isLoadingRef.current || !hasMore) return;

    isLoadingRef.current = true;
    setIsLoadingMore(true);

    const nextPage = currentPageRef.current + 1;

    try {
      const newData = await getImages(fingerprint, nextPage, limit);

      if (newData?.images?.length > 0) {
        // filter out any prepended duplicates
        const newImages = newData.images.filter(
          (newImg) =>
            !allImagesRef.current.some(
              (existingImg) => existingImg.url === newImg.url,
            ),
        );

        setAllImages((prev) => [...prev, ...newImages]);
        setCurrentPage(nextPage);
        setHasMore(newData.pagination.hasMore);
      } else {
        setHasMore(false);
      }
    } catch (error) {
      console.error("Failed to load more images:", error);
    } finally {
      isLoadingRef.current = false;
      setIsLoadingMore(false);
    }
  }, [hasMore, fingerprint]);

  // intersection observer for triggering `loadMore`
  const { ref: observerRef, entry } = useIntersection({
    root: null,
    threshold: 1,
  });

  /*
    Trigger `loadMore` when observer enters the viewport
  */
  useEffect(() => {
    if (entry?.isIntersecting && hasMore) {
      loadMore();
    }
  }, [entry, hasMore, loadMore]);

  /*
    Populate the initial image list from SWR data
  */
  useEffect(() => {
    if (firstPageData) {
      setAllImages(firstPageData.images ?? []);
      setHasMore(firstPageData.pagination?.hasMore ?? true);
    }
  }, [firstPageData]);

  return (
    <>
      {isInitialLoading ? (
        <LoadingGrid />
      ) : (
        <div
          ref={imagesContainerRef}
          className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8"
        >
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
            {allImages.map((image: Image, i: number) => {
              const isLastImage = i === allImages.length - 1;

              return (
                <div
                  key={`${image.url}-${i}`}
                  ref={isLastImage ? observerRef : undefined}
                  className={`aspect-h-1 aspect-w-1 relative cursor-help xl:aspect-h-7 xl:aspect-w-7 ${
                    i === 0 && "md:col-span-2 md:row-span-2"
                  } rounded-sm shadow-lg transition-transform duration-200 ease-in-out`}
                >
                  <div className="absolute z-10 flex h-full w-full items-center justify-center bg-white opacity-0 transition-opacity duration-200 hover:opacity-75">
                    <p className="p-5 text-center text-lg font-light">
                      &quot;
                      {image.name
                        .split("_")
                        .shift()
                        ?.toString()
                        .split(".")
                        .shift()}
                      &quot;
                    </p>
                  </div>

                  <SmartImage
                    imageKey={i}
                    imageName={image.name}
                    imageUrl={image.url}
                    availableSizes={image.availableSizes}
                    staggerDelay={i < 5 ? 0 : (i - 5) * 50}
                  />
                </div>
              );
            })}
          </div>

          {isLoadingMore && (
            <div className="flex items-center justify-center py-8">
              <ArrowPathIcon className="h-5 w-5 animate-spin text-violet-500" />

              <span className="ml-2 text-violet-500">
                Loading more images...
              </span>
            </div>
          )}

          {!hasMore && allImages.length > 0 && (
            <div className="flex items-center justify-center py-8">
              <p className="text-gray-500">No more images to load</p>
            </div>
          )}
        </div>
      )}
    </>
  );
};

export default Images;
