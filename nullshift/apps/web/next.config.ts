import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the workspace root (nullshift/) so Turbopack doesn't pick a stray
  // lockfile in a parent directory.
  turbopack: {
    root: path.join(import.meta.dirname, "..", ".."),
  },
  // Workspace packages ship raw TS — Next compiles them in-app.
  transpilePackages: [
    "@nullshift/ui",
    "@nullshift/db",
    "@nullshift/auth",
    "@nullshift/billing",
    "@nullshift/config",
    "@nullshift/content",
  ],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
    ],
  },
  experimental: {
    serverActions: {
      // Portal issue reports carry phone screenshots (1.5–4MB is normal);
      // the 1MB default rejects them before the action runs.
      bodySizeLimit: "8mb",
    },
  },
};

export default nextConfig;
