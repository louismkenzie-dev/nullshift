import React from "react";
import type { ClientStory } from "@nullshift/content/clientStories";
import { Reveal } from "@/components/kyma";
import { StoryCard } from "./StoryCard";

/** Three cards, each jumping to its story section further down the page. */
export function ClientStoryGallery({
  stories,
  theme = "cream",
}: {
  stories: ClientStory[];
  theme?: "dark" | "cream";
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {stories.map((s, i) => (
        <Reveal key={s.slug} delay={i * 0.07}>
          <StoryCard story={s} href={`#${s.slug}`} theme={theme} />
        </Reveal>
      ))}
    </div>
  );
}
