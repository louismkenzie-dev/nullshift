import type { Metadata } from "next";
import { Suspense } from "react";
import { T } from "@/lib/tokens";
import { FunnelClient } from "./FunnelClient";

export const metadata: Metadata = {
  title: "Get started — Nullshift",
  description:
    "Answer a few quick questions and we'll recommend exactly what your business needs — and show you the next step. Takes under a minute.",
};

export default function StartPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: "100dvh", background: T.bg }} />}>
      <FunnelClient />
    </Suspense>
  );
}
