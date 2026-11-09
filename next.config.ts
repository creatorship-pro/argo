import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // A self-contained server build, so the container stays small (ticket S7).
  output: "standalone",
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
