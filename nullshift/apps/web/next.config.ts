import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The local review browser uses the loopback IP, not the localhost hostname.
  allowedDevOrigins: ["127.0.0.1"],
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
    "@nullshift/agents",
  ],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
    ],
  },
  // Public embeds (/w quote widget, /p plan generator) are designed to be
  // framed by customers' websites. Everything else keeps the default.
  async headers() {
    return [
      {
        source: "/(w|p)/:path*",
        headers: [{ key: "Content-Security-Policy", value: "frame-ancestors *" }],
      },
      {
        source: "/(widget|plan).js",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Cache-Control", value: "public, max-age=3600" },
        ],
      },
    ];
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
