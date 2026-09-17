import { unitProgress } from "./scrollFilmHero";

/** Original Blender all-intra export, copied without transcoding. */
export const CAPABILITIES_FILM = {
  src: "/media/capabilities/nullshift-capabilities-scroll.mp4",
  poster: "/media/capabilities/nullshift-capabilities-poster.jpg",
  portraitSrc: "/media/capabilities/nullshift-capabilities-portrait.mp4",
  portraitPoster: "/media/capabilities/nullshift-capabilities-portrait-poster.jpg",
  portraitWidth: 406,
  portraitHeight: 720,
  width: 1280,
  height: 720,
  fps: 24,
};

// Seconds from Blender's supplied scroll-cues.json, not arbitrary scroll intervals.
export const CAPABILITY_CUES = [
  { label: "Bookings", start: 65 / 24, end: 105 / 24 },
  { label: "Payments", start: 105 / 24, end: 153 / 24 },
  { label: "Finances", start: 153 / 24, end: 197 / 24 },
  { label: "Instruments", start: 197 / 24, end: 277 / 24 },
  { label: "Management", start: 277 / 24, end: 321 / 24 },
  { label: "Staffing", start: 321 / 24, end: 365 / 24 },
] as const;

const ease = (value: number) => {
  const x = unitProgress(value);
  return x * x * (3 - 2 * x);
};

export function capabilitiesFrame(progress: number, duration = 16) {
  const p = unitProgress(progress);
  const length = Number.isFinite(duration) && duration > 0 ? duration : 16;
  const time = unitProgress(p / 0.9) * Math.max(0, length - 1 / CAPABILITIES_FILM.fps);
  const blackout = ease((p - 0.865) / 0.065);
  return {
    progress: p,
    time,
    blackout,
    sceneBlur: blackout * 18,
    anything: ease((p - 0.945) / 0.035),
    words: CAPABILITY_CUES.map(({ start, end }) => {
      const incoming = ease((time - start) / 0.24);
      const outgoing = ease((time - (end - 0.28)) / 0.28);
      const opacity = incoming * (1 - outgoing);
      return {
        opacity,
        blur: (1 - opacity) * 12,
        lift: (1 - incoming) * 40 - outgoing * 40,
      };
    }),
  };
}

/** Mobile has no film lead-in: start with Bookings, then retain the same sequence. */
export function capabilitiesTextFrame(progress: number) {
  const p = unitProgress(progress);
  const first = ((CAPABILITY_CUES[0].start + 0.25) / (16 - 1 / 24)) * 0.9;
  return { ...capabilitiesFrame(first + (1 - first) * p), progress: p };
}

/** Portrait cover crop follows the handset as Blender's camera moves right. */
export function capabilitiesFraming(width: number, height: number, progress: number) {
  if (width <= 0 || height <= 0 || width / height > 1.2) return 50;
  const scale = Math.max(
    width / CAPABILITIES_FILM.width,
    height / CAPABILITIES_FILM.height
  );
  const filmWidth = CAPABILITIES_FILM.width * scale;
  const overflow = filmWidth - width;
  if (overflow <= 0) return 50;
  const phoneCentre = 0.76 + 0.07 * unitProgress(progress / 0.9);
  return unitProgress((phoneCentre * filmWidth - width / 2) / overflow) * 100;
}
