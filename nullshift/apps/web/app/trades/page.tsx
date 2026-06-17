import type { Metadata } from "next";
import { VerticalLanding } from "@/components/marketing/VerticalLanding";
import { TRADES } from "@nullshift/content/marketing";

export const metadata: Metadata = {
  title: "Never Miss a Job — Websites + lead systems for UK trades | Nullshift",
  description:
    "Plumbers, electricians, builders — stop losing £24k/yr to missed calls. Bespoke fast site + missed-call text-back, 24/7 AI receptionist and review automation. Live in weeks, you own it, from £149/mo.",
};

export default function TradesPage() {
  return <VerticalLanding config={TRADES} />;
}
