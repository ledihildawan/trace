import { OdysseyConfig } from '../config/odyssey-config.js';

// The arithmetic behind wheel and touch navigation, separated from the event
// plumbing so it can be reasoned about — and tested — on its own.

const DELTA_MODE_PIXEL = 0;
const DELTA_MODE_LINE = 1;

// Wheel events report their delta in pixels, lines, or pages depending on the
// device and platform. Normalise everything to pixels.
export function wheelDeltaToPixels(deltaY, deltaMode, viewportHeight) {
  if (deltaMode === DELTA_MODE_PIXEL) return deltaY;
  if (deltaMode === DELTA_MODE_LINE) return deltaY * OdysseyConfig.physics.wheelLineHeightPx;
  return deltaY * viewportHeight;
}

// How many whole years a pixel delta should travel. Always at least one step,
// so a small flick still moves — `max` caps a violent one.
export function stepsFromPixels(deltaPx, pixelsPerStep, max = Infinity) {
  const perStep = Math.max(pixelsPerStep, 1);
  const magnitude = Math.min(max, Math.max(1, Math.round(Math.abs(deltaPx) / perStep)));
  return deltaPx > 0 ? magnitude : -magnitude;
}

// Average velocity in px/ms across the sample window, positive when the
// content is being pushed upward (i.e. travelling forward in time).
export function flingVelocity(samples) {
  if (!Array.isArray(samples) || samples.length < 2) return 0;
  const first = samples.at(0);
  const last = samples.at(-1);
  const dt = Math.max(1, last.t - first.t);
  return (first.y - last.y) / dt;
}

// A fling is only a fling past a threshold; below it the grid should settle
// onto the nearest year instead of jumping.
export function isFling(velocity) {
  return Math.abs(velocity) > OdysseyConfig.physics.flingVelocityThreshold;
}

// Projects a fling velocity into a year step count.
export function stepsFromFling(velocity, pixelsPerStep) {
  const projectedPx = velocity * OdysseyConfig.physics.flingProjectionMs;
  return stepsFromPixels(projectedPx, pixelsPerStep, OdysseyConfig.physics.flingMaxSteps);
}

// Keeps the most recent `limit` samples, oldest first.
export function pushSample(samples, sample, limit = OdysseyConfig.physics.flingSampleCount) {
  samples.push(sample);
  if (samples.length > limit) samples.shift();
  return samples;
}
