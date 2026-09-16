/** Pure helpers shared by the isolated showcase and its tests. */
export const SHOWCASE_ASSETS = {
  "studio-display.jpg": "image/jpeg",
  "suffolk-logo.png": "image/png",
  "programme.png": "image/png",
  "programme.mp4": "video/mp4",
  "ledger.png": "image/png",
  "ledger.mp4": "video/mp4",
  "progress.png": "image/png",
  "progress.mp4": "video/mp4",
  "portrait-iphone.jpg": "image/jpeg",
  "parent-home.png": "image/png",
  "parent-bookings.png": "image/png",
  "parent-home.mp4": "video/mp4",
  "parent-report.png": "image/png",
  "parent-report.mp4": "video/mp4",
} as const;

export function showcaseEnabled(
  environment: string | undefined,
  flag: string | undefined
) {
  return environment === "development" && flag === "1";
}

export const clamp = (value: number, low = 0, high = 1) =>
  Math.min(high, Math.max(low, value));
export const smooth = (value: number) => {
  const x = clamp(value);
  return x * x * (3 - 2 * x);
};

export const CHAPTERS = [
  {
    label: "The platform",
    title: "An entire operation. One place.",
    detail:
      "Programmes, bookings, payments and player development — connected in one bespoke platform.",
    features: ["County administration", "Parent Hub", "Coaching reports"],
    start: 0,
    end: 0.18,
  },
  {
    label: "Programme management",
    title: "Organise the whole programme.",
    detail:
      "Create training programmes, manage session dates and keep track of player places from one admin workspace.",
    features: ["Training programmes", "Session scheduling", "Player places"],
    start: 0.18,
    end: 0.45,
    clip: "programme",
  },
  {
    label: "Bookings & payments",
    title: "Know who’s booked. And who’s paid.",
    detail:
      "See each booking alongside its payment status, parent and player details — without piecing together separate records.",
    features: ["Booking ledger", "Payment status", "Parent & player records"],
    start: 0.45,
    end: 0.72,
    clip: "ledger",
  },
  {
    label: "Player progress",
    title: "Make coaching progress visible.",
    detail:
      "Give families access to individual coaching reports, skill assessments and clear next steps through the Parent Hub.",
    features: ["Individual reports", "Skill assessments", "Development goals"],
    start: 0.72,
    end: 1,
    clip: "progress",
  },
] as const;

export const PARENT_CHAPTERS = [
  {
    label: "The Parent Hub",
    title: "Their tennis. In their pocket.",
    detail: "A mobile home for each family’s bookings, players and progress.",
    start: 0,
    end: 0.3,
    clip: "parent-home",
  },
  {
    label: "Family overview",
    title: "One hub. Every next step.",
    detail: "Keep upcoming training and player details together, wherever parents are.",
    start: 0.3,
    end: 0.63,
    clip: "parent-home",
  },
  {
    label: "Coaching reports",
    title: "Progress they can see.",
    detail:
      "Open a player’s report to explore coaching feedback, skill scores and development goals.",
    start: 0.63,
    end: 1,
    clip: "parent-report",
  },
] as const;

/** Small frame-rate-independent catch-up, with no scroll hijacking or perpetual loop. */
export function dampProgress(current: number, target: number, elapsedMs: number) {
  const next =
    current + (target - current) * (1 - Math.exp(-clamp(elapsedMs, 0, 64) / 95));
  return Math.abs(next - target) < 0.0001 ? target : next;
}

/** Hold the opening and closing states so the viewer can read before/after the action. */
export function clipTime(progress: number, start: number, end: number, duration: number) {
  const portion = clamp((progress - start) / (end - start));
  return clamp((portion - 0.12) / 0.76) * Math.max(0, duration - 0.04);
}

export function parentFrame(progress: number) {
  const p = clamp(Number.isFinite(progress) ? progress : 0);
  return { progress: p, chapter: p < 0.3 ? 0 : p < 0.63 ? 1 : 2, zoom: smooth(p / 0.36) };
}

export function showcaseFrame(progress: number) {
  const p = clamp(Number.isFinite(progress) ? progress : 0);
  const chapter = p < 0.18 ? 0 : p < 0.45 ? 1 : p < 0.72 ? 2 : 3;
  const current = CHAPTERS[chapter];
  return {
    progress: p,
    chapter,
    clipProgress: clamp((p - current.start) / (current.end - current.start)),
    zoom: Math.min(1.68, 1 + 0.68 * smooth(p / 0.22)),
    logoOpacity: 1 - smooth((p - 0.12) / 0.07),
  };
}

/** Exact projective placement onto the photographed screen, not a rotated rectangle.
 * Corner measurements use the 3000 × 2000 Photoshop export, normalised here.
 */
export function screenMatrix(photoWidth: number) {
  const photoHeight = photoWidth / 1.5;
  const corners = [
    [0.2896, 0.2133],
    [0.7141, 0.2117],
    [0.7109, 0.5677],
    [0.2924, 0.5707],
  ];
  const [[x0, y0], [x1, y1], [x2, y2], [x3, y3]] = corners.map(([x, y]) => [
    x * photoWidth,
    y * photoHeight,
  ]);
  const dx1 = x1 - x2,
    dx2 = x3 - x2,
    dx3 = x0 - x1 + x2 - x3;
  const dy1 = y1 - y2,
    dy2 = y3 - y2,
    dy3 = y0 - y1 + y2 - y3;
  const determinant = dx1 * dy2 - dx2 * dy1;
  const g = (dx3 * dy2 - dx2 * dy3) / determinant;
  const h = (dx1 * dy3 - dx3 * dy1) / determinant;
  const a = x1 - x0 + g * x1,
    b = x3 - x0 + h * x3;
  const d = y1 - y0 + g * y1,
    e = y3 - y0 + h * y3;
  return [
    a / 1600,
    d / 1600,
    0,
    g / 1600,
    b / 900,
    e / 900,
    0,
    h / 900,
    0,
    0,
    1,
    0,
    x0,
    y0,
    0,
    1,
  ];
}

export function parseByteRange(
  header: string,
  length: number
): { start: number; end: number } | null {
  const match = /^bytes=(\d*)-(\d*)$/.exec(header);
  if (!match || (!match[1] && !match[2]) || length <= 0) return null;
  const suffix = !match[1];
  const start = suffix ? Math.max(0, length - Number(match[2])) : Number(match[1]);
  const end = suffix || !match[2] ? length - 1 : Math.min(Number(match[2]), length - 1);
  return Number.isSafeInteger(start) &&
    Number.isSafeInteger(end) &&
    start >= 0 &&
    start <= end &&
    start < length
    ? { start, end }
    : null;
}
