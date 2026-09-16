/** Temporary owned brand study. Replace these two files after film approval. */
export const HERO_FILM = {
  src: "/media/hero/nullshift-brand-study.mp4",
  poster: "/media/hero/nullshift-brand-study.jpg",
  // The temporary logo film is square. Switch to cover for the approved wide film.
  fit: "contain" as const,
};

export const unitProgress = (value: number) =>
  Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));

export function heroFrame(progress: number) {
  const p = unitProgress(progress);
  const title = 1 - unitProgress(p / 0.35);
  return {
    progress: p,
    title,
    blur: (1 - title) * 12,
    lift: (1 - title) * -40,
    closing: unitProgress((p - 0.78) / 0.18),
    scale: 1 + p * 0.06,
  };
}

export function filmTime(progress: number, duration: number) {
  return Number.isFinite(duration) && duration > 0
    ? unitProgress(progress) * Math.max(0, duration - 0.04)
    : 0;
}
