/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      {
        protocol: "https",
        hostname: process.env.AZURE_STORAGE_HOSTNAME,
        pathname: "/images/**",
      },
    ],
  },
  webpack: (config) => {
    config.ignoreWarnings = [
      /webpack.cache.PackFileCacheStrategy\/webpack.FileSystemInfo/,
    ];

    return config;
  },
};

module.exports = nextConfig;
