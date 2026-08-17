import type { Metadata } from "next";
import { Suspense } from "react";
import { T } from "@nullshift/ui/tokens";
import { FunnelClient } from "./FunnelClient";

export const metadata: Metadata = {
  title: "Agent Consultation — Nullshift",
  description:
    "A free consultation with the Nullshift Agent. Answer a few quick questions and it drafts a tailored plan for your business — with a live mockup of your system so you can see it in action.",
};

export default function StartPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: "100dvh", background: T.bg }} />}>
      <FunnelClient />
    </Suspense>
  );
}
