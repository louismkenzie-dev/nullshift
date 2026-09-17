/** Blender's “The System Opens”: eight seconds, all-intra H.264 for scroll seeking. */
export const HERO_FILM = {
  src: "/media/hero/nullshift-system-opens-desktop.mp4",
  poster: "/media/hero/nullshift-system-opens-poster.jpg",
  portraitSrc: "/media/hero/nullshift-system-opens-portrait.mp4",
  portraitPoster: "/media/hero/nullshift-system-opens-portrait-poster.jpg",
  fps: 24,
  fit: "cover" as const,
};

export const PORTRAIT_FILM_QUERY = "(max-width: 700px) and (max-aspect-ratio: 6/5)";

export const unitProgress = (value: number) =>
  Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));

// Reveal the opening frame before advancing the film. Both phases reverse on scroll.
export const HERO_REVEAL_END = 0.12;
const filmProgress = (progress: number) =>
  unitProgress((unitProgress(progress) - HERO_REVEAL_END) / (1 - HERO_REVEAL_END));

export function heroFrame(progress: number) {
  const p = unitProgress(progress);
  const playback = filmProgress(p);
  const reveal = unitProgress(p / HERO_REVEAL_END);
  const title = 1 - unitProgress(playback / 0.35);
  return {
    progress: p,
    filmReveal: reveal * reveal * (3 - 2 * reveal),
    title,
    // Clear the opening actions before the film starts moving.
    actions: 1 - unitProgress((p - 0.015) / 0.065),
    blur: (1 - title) * 12,
    lift: (1 - title) * -40,
    middle: unitProgress((p - 0.44) / 0.08) * (1 - unitProgress((p - 0.64) / 0.1)),
    closing: unitProgress((p - 0.78) / 0.18),
    scale: 1 + playback * 0.06,
  };
}

export function filmTime(progress: number, duration: number) {
  return Number.isFinite(duration) && duration > 0
    ? filmProgress(progress) * Math.max(0, duration - 0.04)
    : 0;
}
