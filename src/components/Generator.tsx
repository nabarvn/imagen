"use client";

import useSWR, { mutate } from "swr";
import type { Image } from "@/typings";
import { toast } from "react-hot-toast";
import { isMobile } from "react-device-detect";
import { getPromptSuggestion, getImages } from "@/lib";
import { useFingerprint } from "@/components/Fingerprint";
import { FormEvent, KeyboardEvent, useState, useRef, useEffect } from "react";

import {
  SparklesIcon,
  LightBulbIcon,
  PaperAirplaneIcon,
} from "@heroicons/react/24/outline";

const Generator = () => {
  const { fingerprint } = useFingerprint();

  const [input, setInput] = useState("");
  const [charCount, setCharCount] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const maxChars = 500;

  const {
    data: suggestion,
    isLoading,
    mutate: mutateSuggestion,
    isValidating,
  } = useSWR("suggestion", () => getPromptSuggestion(fingerprint), {
    revalidateOnFocus: false,
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  const loading = isLoading || isValidating || isGenerating;

  const adjustTextareaHeight = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  };

  const handleInputChange = (value: string) => {
    if (value.length <= maxChars) {
      setInput(value);
      setCharCount(value.length);

      setTimeout(adjustTextareaHeight, 0);
    }
  };

  useEffect(() => {
    adjustTextareaHeight();
  }, [input]);

  const submitPrompt = async (useSuggestion?: boolean) => {
    const customPrompt = input.trim();

    if (!useSuggestion && !customPrompt) {
      return;
    }

    const rawPrompt = useSuggestion ? suggestion : customPrompt;

    const notification = toast.loading(
      "DALL-E is generating an image for you...",
    );

    setInput("");
    setCharCount(0);
    setIsGenerating(true);

    try {
      const response = await fetch("/api/create-image", {
        method: "POST",
        headers: {
          "Content-type": "application/json",
          Accept: "application/json",
          "X-Fingerprint": fingerprint ?? "",
        },
        body: JSON.stringify({
          rawPrompt,
          source: useSuggestion ? "suggestion" : "custom",
        }),
      });

      if (response.status === 429 || response.status === 400) {
        const errorBody = await response.json();

        toast.error(errorBody.error, {
          id: notification,
        });

        return;
      }

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message ?? "Failed to generate image");
      }

      toast.success("Your AI generated image is here!", {
        id: notification,
      });

      // fetch the new image and dispatch a custom event
      const newImageData = await getImages(fingerprint, 1, 1);

      if (newImageData?.images?.[0]) {
        const newImage = newImageData.images[0];

        const event = new CustomEvent<Image>("new-image-generated", {
          detail: newImage,
        });

        document.dispatchEvent(event);
      } else {
        await mutate("images-page-1");
      }
    } catch (err) {
      toast.error(
        (err instanceof Error && err.message) || "Failed to generate image.",
        {
          id: notification,
        },
      );
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!input.trim()) {
      return;
    }

    await submitPrompt();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !isMobile) {
      e.preventDefault();
      handleSubmit(e as unknown as FormEvent<HTMLFormElement>);
    }
  };

  return (
    <div className="mx-auto my-8 max-w-7xl">
      <div className="px-4 sm:px-6 lg:px-8">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="group relative">
            <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-violet-500/10 to-purple-500/10 opacity-0 blur-xl transition-all duration-300 group-focus-within:opacity-100 group-focus-within:blur-sm" />

            <div className="relative rounded-xl border-2 border-gray-200 bg-white shadow-md transition-all duration-300 focus-within:border-violet-400 focus-within:shadow-violet-100">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => handleInputChange(e.target.value)}
                onKeyDown={handleKeyDown}
                className="max-h-[120px] min-h-[60px] w-full resize-none rounded-xl bg-transparent px-4 pb-6 pt-4 text-base leading-relaxed placeholder-gray-400 outline-none transition-all duration-200 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-violet-300 focus:placeholder-gray-300 md:min-h-[120px] md:text-lg"
                placeholder="Describe the image you want to create..."
                disabled={loading}
              />

              <div className="absolute bottom-3 right-4 flex items-center space-x-2">
                <span
                  className={`text-sm font-medium transition-colors duration-200 ${
                    charCount > maxChars * 0.8
                      ? charCount === maxChars
                        ? "text-red-500"
                        : "text-amber-500"
                      : "text-gray-400"
                  }`}
                >
                  {charCount}/{maxChars}
                </span>
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={!input.trim() || loading}
              className={`group relative flex-1 transform overflow-hidden rounded-xl px-4 py-2 text-base font-semibold shadow-md transition-all duration-300 md:px-6 md:py-3 md:text-lg ${
                input.trim() && !loading
                  ? "bg-gradient-to-r from-violet-600 to-purple-600 text-white hover:from-violet-700 hover:to-purple-700 active:scale-[0.98]"
                  : "cursor-not-allowed bg-gray-100 text-gray-400"
              }`}
            >
              <div className="flex items-center justify-center space-x-3">
                <PaperAirplaneIcon className="h-4 w-4 md:h-5 md:w-5" />
                <span>Generate Image</span>
              </div>
            </button>

            <button
              type="button"
              onClick={() => mutateSuggestion()}
              disabled={loading}
              className={`transform rounded-xl px-3 py-2 text-sm font-semibold shadow-md transition-all duration-300 sm:w-auto md:px-4 md:py-3 md:text-base ${
                !loading
                  ? "border-2 border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50 text-amber-700 hover:border-amber-300 hover:from-amber-100 hover:to-orange-100 active:scale-[0.98]"
                  : "cursor-not-allowed border-2 border-gray-100 bg-gray-50 text-gray-400"
              }`}
            >
              <div className="flex items-center justify-center space-x-2">
                {isValidating ? (
                  <div className="h-3 w-3 animate-spin rounded-full border-2 border-amber-600 border-t-transparent md:h-4 md:w-4" />
                ) : (
                  <LightBulbIcon className="h-3 w-3 md:h-4 md:w-4" />
                )}

                <span>New Idea</span>
              </div>
            </button>
          </div>
        </form>

        <div className="mt-4 rounded-xl border border-violet-200 bg-gradient-to-r from-violet-50 to-purple-50 p-4 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 flex-1 items-start space-x-3">
              <div className="mt-1 flex-shrink-0 rounded-lg">
                <SparklesIcon className="h-4 w-4 text-violet-600" />
              </div>

              <div className="min-w-0 flex-1">
                <h3 className="mb-1 text-base font-semibold text-violet-900">
                  AI Suggestion
                </h3>

                <div className="break-words text-sm leading-relaxed text-violet-700">
                  {isValidating ? (
                    <div className="animate-pulse space-y-2 pt-1.5">
                      <div className="h-4 w-full rounded bg-violet-300" />
                      <div className="h-4 w-3/4 rounded bg-violet-300" />
                      <div className="h-4 w-5/6 rounded bg-violet-300 md:hidden" />
                    </div>
                  ) : (
                    suggestion
                  )}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => submitPrompt(true)}
              disabled={loading}
              className={`flex-shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition-all duration-200 ${
                !loading
                  ? "bg-violet-600 text-white shadow-sm hover:bg-violet-700"
                  : "cursor-not-allowed bg-gray-300 text-gray-500"
              }`}
            >
              Use
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Generator;
