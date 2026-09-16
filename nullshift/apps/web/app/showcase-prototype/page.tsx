import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ShowcasePrototype } from "@/components/marketing/showcase/ShowcasePrototype";
import { showcaseEnabled } from "@/lib/showcasePrototype";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Suffolk Tennis — local showcase study",
  robots: { index: false, follow: false },
};

export default function ShowcasePrototypePage() {
  // Deliberately unavailable in every production build, even if the flag leaks.
  if (!showcaseEnabled(process.env.NODE_ENV, process.env.LOCAL_SHOWCASE)) notFound();
  return <ShowcasePrototype />;
}
