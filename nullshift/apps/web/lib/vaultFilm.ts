export const VAULT_FILM = {
  src: "/media/vault/nullshift-vault-scroll.mp4",
  mobileSrc: "/media/vault/nullshift-vault-scroll-720.mp4",
  poster: "/media/vault/nullshift-vault-poster-1080.webp",
  mobilePoster: "/media/vault/nullshift-vault-poster-720.webp",
  fps: 30,
  frames: 240,
} as const;

// Hold the recognisable opening angle on entry; finish while still visible.
// Natural page travel owns the turn, without pinning or a second easing layer.
export function vaultProgress(top: number, height: number, viewport: number) {
  if (!Number.isFinite(top) || height <= 0 || viewport <= 0) return 0;
  const start = viewport * 0.72;
  const end = viewport * 0.16 - height * 0.3;
  return Math.min(1, Math.max(0, (start - top) / (start - end)));
}

export function vaultTime(progress: number) {
  const clamped = Number.isFinite(progress) ? Math.min(1, Math.max(0, progress)) : 0;
  return Math.round(clamped * (VAULT_FILM.frames - 1)) / VAULT_FILM.fps;
}
