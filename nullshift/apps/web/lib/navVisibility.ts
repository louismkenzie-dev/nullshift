export type NavScrollState = {
  anchor: number;
  previous: number;
  direction: -1 | 0 | 1;
  hidden: boolean;
};

/** Separate enter/exit points let the handover reverse without threshold chatter. */
export function navCompactState(compact: boolean, scrollY: number): boolean {
  const y = Number.isFinite(scrollY) ? Math.max(0, scrollY) : 0;
  return compact ? y > 16 : y > 56;
}

/** Direction hysteresis prevents a trackpad tremor from flickering the header. */
export function navScrollState(
  state: NavScrollState,
  scrollY: number,
  keepVisible = false
): NavScrollState {
  const y = Math.max(0, scrollY);
  if (keepVisible || y < 120)
    return { anchor: y, previous: y, direction: 0, hidden: false };
  const delta = y - state.previous;
  if (Math.abs(delta) < 1) return state;
  const direction = delta > 0 ? 1 : -1;
  const anchor = state.direction === direction ? state.anchor : state.previous;
  const threshold = direction === 1 ? 32 : 14;
  return {
    anchor,
    previous: y,
    direction,
    hidden: Math.abs(y - anchor) >= threshold ? direction === 1 : state.hidden,
  };
}
