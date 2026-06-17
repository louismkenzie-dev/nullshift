const WINDOW_MS = 60 * 60 * 1000;
const MAX_ATTEMPTS = 3;

const attempts = new Map<string, number[]>();

export function isResendRateLimited(email: string): boolean {
  const key = email.toLowerCase();
  const now = Date.now();
  const timestamps = attempts.get(key) ?? [];
  const recent = timestamps.filter((t) => now - t < WINDOW_MS);

  if (recent.length >= MAX_ATTEMPTS) {
    attempts.set(key, recent);
    return true;
  }

  return false;
}

export function recordResendAttempt(email: string): void {
  const key = email.toLowerCase();
  const now = Date.now();
  const timestamps = attempts.get(key) ?? [];
  const recent = timestamps.filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  attempts.set(key, recent);
}
