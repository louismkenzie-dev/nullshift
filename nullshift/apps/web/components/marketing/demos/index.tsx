import React from "react";
import type { ClientStory, DemoKey } from "@nullshift/content/clientStories";
import { TdePricingDemo } from "./TdePricingDemo";
import { NftReflectionsDemo } from "./NftReflectionsDemo";
import { SuffolkReportsDemo } from "./SuffolkReportsDemo";

/** Live demos, keyed by `story.demo`. Each one is a screen from the
 *  client's product reproduced from their codebase — same copy, palette
 *  and typefaces — and driven by the client's own logic, ported verbatim
 *  (see the `logic.ts` beside each demo). Adding a client = a new key
 *  here and in `DemoKey`. */
const DEMOS: Record<
  DemoKey,
  React.ComponentType<{ story: ClientStory; theme: "dark" | "cream" }>
> = {
  "tde-pricing": TdePricingDemo,
  "nft-reflections": NftReflectionsDemo,
  "suffolk-reports": SuffolkReportsDemo,
};

export function LiveDemo({
  story,
  theme,
}: {
  story: ClientStory;
  theme: "dark" | "cream";
}) {
  const Demo = DEMOS[story.demo];
  return <Demo story={story} theme={theme} />;
}
