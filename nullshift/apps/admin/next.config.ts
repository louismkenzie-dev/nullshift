import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: path.join(import.meta.dirname, "..", ".."),
  },
  transpilePackages: [
    "@nullshift/ui",
    "@nullshift/db",
    "@nullshift/auth",
    "@nullshift/config",
    "@nullshift/content",
  ],
};

export default nextConfig;
