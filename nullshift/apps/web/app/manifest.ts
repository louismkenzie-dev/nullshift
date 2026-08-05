import type { MetadataRoute } from "next";

/**
 * PWA manifest — lets the admin and client portal be added to a phone's home
 * screen as a standalone app (the stepping stone to a store-distributed app).
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "NullShift",
    short_name: "NullShift",
    description: "NullShift — systems, run properly.",
    start_url: "/portal",
    display: "standalone",
    background_color: "#0a0a0a",
    theme_color: "#0a0a0a",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
