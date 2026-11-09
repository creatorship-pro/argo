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
  // The FDE iPads and the run board open the app over the network, so dev
  // resources (including the HMR socket) must be allowed from the hosts doing
  // that. Without this the page stays on "Loading…": Next blocks the request,
  // hydration never runs, and no error is shown.
  // Set DEV_ORIGINS=http://host:3100,... in .env.local (comma separated hosts).
  allowedDevOrigins: [
    "127.0.0.1",
    "localhost",
    ...(process.env.DEV_ORIGINS ?? "")
      .split(",")
      .map((o) => o.trim().replace(/^https?:\/\//, "").replace(/:\d+$/, ""))
      .filter(Boolean),
  ],
};

export default nextConfig;
