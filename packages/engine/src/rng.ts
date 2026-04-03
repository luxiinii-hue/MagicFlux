/**
 * Seeded pseudo-random number generator.
 *
 * Uses a simple mulberry32 algorithm — fast, deterministic, sufficient for
 * card games. Every operation returns the next RNG state alongside the result
 * so the engine stays pure (no hidden mutable state).
 */

/** Advance the RNG state and produce a float in [0, 1). */
export function nextRandom(state: number): { value: number; nextState: number } {
  let t = (state + 0x6d2b79f5) | 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  const nextState = ((t ^ (t >>> 14)) >>> 0);
  return { value: nextState / 4294967296, nextState };
}

/** Produce a random integer in [0, max) and the next state. */
export function nextInt(state: number, max: number): { value: number; nextState: number } {
  const { value, nextState } = nextRandom(state);
  return { value: Math.floor(value * max), nextState };
}

/**
 * Fisher-Yates shuffle. Returns a new array (no mutation) and the next
 * RNG state.
 */
export function shuffle<T>(array: readonly T[], state: number): { result: T[]; nextState: number } {
  const result = [...array];
  let currentState = state;
  for (let i = result.length - 1; i > 0; i--) {
    const { value: j, nextState } = nextInt(currentState, i + 1);
    currentState = nextState;
    [result[i], result[j]] = [result[j], result[i]];
  }
  return { result, nextState: currentState };
}
