import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Workspace packages ship raw TS — Next compiles them in-app.
  transpilePackages: [
    "@nullshift/ui",
    "@nullshift/db",
    "@nullshift/auth",
    "@nullshift/billing",
    "@nullshift/config",
  ],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
    ],
  },
};

export default nextConfig;
