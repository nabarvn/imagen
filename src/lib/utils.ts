import { Metadata } from "next";

export function constructMetadata({
  title = "Imagen - Bring Your Imagination to Life with DALL-E",
  description = "Effortlessly transform your ideas into captivating visual art with our intuitive AI image generator.",
  image = "/thumbnail.png",
  icons = [
    {
      rel: "icon",
      url: "/favicon.ico", // for standard browsers
    },
    {
      rel: "apple-touch-icon",
      url: "/logo.png", // for Apple devices
    },
  ],
  noIndex = false, // allow search engine bots to crawl and index the website
}: {
  title?: string;
  description?: string;
  image?: string;
  icons?: Metadata["icons"];
  noIndex?: boolean;
} = {}): Metadata {
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: [
        {
          url: image,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image],
      creator: "@nabarvn",
    },
    icons,
    metadataBase: new URL("https://imagen.nabarun.app"),
    ...(noIndex && {
      robots: {
        index: false,
        follow: false,
      },
    }),
  };
}
