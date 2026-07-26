// Timing curves for programmatic scrolling. Pure functions, so the feel of the
// motion can be reasoned about without running the app.

// Standard ease-in-out cubic on a 0–1 progress value.
export function easeInOutCubic(t) {
  const p = Math.min(Math.max(t, 0), 1);
  return p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
}

// A nudge of one or two years should feel immediate; beyond three it stops
// getting slower, otherwise held keys pile up an ever-longer animation.
const NUDGE_BASE_MS = 200;
const NUDGE_PER_STEP_MS = 50;
const NUDGE_MAX_STEPS = 3;

export function durationForSteps(steps) {
  const capped = Math.min(Math.abs(steps), NUDGE_MAX_STEPS);
  return NUDGE_BASE_MS + capped * NUDGE_PER_STEP_MS;
}

// Travel time grows with distance but flattens out, so crossing a century does
// not take twenty times longer than crossing five years. The four segments are
// continuous at their joins (5, 20, 100) and the whole curve is capped.
const CURVE = [
  { upTo: 5, base: 280, perUnit: 40, from: 0 },
  { upTo: 20, base: 480, perUnit: 24, from: 5 },
  { upTo: 100, base: 840, perUnit: 6, from: 20 },
];
const FAR_BASE_MS = 1320;
const FAR_LOG_SCALE = 80;
const MAX_DURATION_MS = 2400;

export function durationForDistance(indexDistance) {
  const distance = Math.abs(indexDistance);
  if (distance <= 0) return 0;
  for (const segment of CURVE) {
    if (distance <= segment.upTo) {
      return segment.base + (distance - segment.from) * segment.perUnit;
    }
  }
  return Math.min(MAX_DURATION_MS, FAR_BASE_MS + Math.log2(distance - 99) * FAR_LOG_SCALE);
}

