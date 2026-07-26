import test from 'node:test';
import assert from 'node:assert/strict';

import {
  flingVelocity,
  isFling,
  pushSample,
  stepsFromFling,
  stepsFromPixels,
  wheelDeltaToPixels,
} from '../js/core/gesture-math.js';
import { OdysseyConfig } from '../js/config/odyssey-config.js';

const P = OdysseyConfig.physics;

test('wheel deltas are normalised to pixels per delta mode', () => {
  assert.equal(wheelDeltaToPixels(120, 0, 1000), 120, 'pixel mode passes through');
  assert.equal(wheelDeltaToPixels(3, 1, 1000), 3 * P.wheelLineHeightPx, 'line mode');
  assert.equal(wheelDeltaToPixels(2, 2, 1000), 2000, 'page mode uses viewport height');
});

test('wheel normalisation preserves direction', () => {
  assert.ok(wheelDeltaToPixels(-120, 0, 1000) < 0);
  assert.ok(wheelDeltaToPixels(-3, 1, 1000) < 0);
});

test('a small scroll still advances exactly one year', () => {
  assert.equal(stepsFromPixels(5, 1000), 1);
  assert.equal(stepsFromPixels(-5, 1000), -1);
  assert.equal(stepsFromPixels(1, 1000), 1, 'never rounds down to a no-op');
});

test('step count scales with distance travelled', () => {
  assert.equal(stepsFromPixels(1000, 1000), 1);
  assert.equal(stepsFromPixels(2400, 1000), 2);
  assert.equal(stepsFromPixels(-3000, 1000), -3);
});

test('step count honours its ceiling', () => {
  assert.equal(stepsFromPixels(100_000, 1000, 4), 4);
  assert.equal(stepsFromPixels(-100_000, 1000, 4), -4);
});

test('a zero or nonsensical step size cannot divide by zero', () => {
  assert.ok(Number.isFinite(stepsFromPixels(500, 0)));
  assert.equal(stepsFromPixels(500, 0), 500);
});

test('fling velocity is px/ms and positive when swiping forward', () => {
  // Finger moves up 100px over 100ms → content travels forward in time.
  const samples = [{ y: 300, t: 0 }, { y: 200, t: 100 }];
  assert.equal(flingVelocity(samples), 1);

  const backward = [{ y: 200, t: 0 }, { y: 300, t: 100 }];
  assert.equal(flingVelocity(backward), -1);
});

test('fling velocity needs at least two samples', () => {
  assert.equal(flingVelocity([]), 0);
  assert.equal(flingVelocity([{ y: 1, t: 1 }]), 0);
  assert.equal(flingVelocity(null), 0);
  assert.equal(flingVelocity(undefined), 0);
});

test('fling velocity survives samples sharing a timestamp', () => {
  const v = flingVelocity([{ y: 300, t: 5 }, { y: 200, t: 5 }]);
  assert.ok(Number.isFinite(v), 'must not divide by zero');
});

test('isFling separates a flick from a slow drag', () => {
  assert.equal(isFling(P.flingVelocityThreshold + 0.1), true);
  assert.equal(isFling(-(P.flingVelocityThreshold + 0.1)), true);
  assert.equal(isFling(P.flingVelocityThreshold - 0.1), false);
  assert.equal(isFling(0), false);
});

test('a fling projects into a capped number of year steps', () => {
  const perYear = 1000;
  assert.equal(stepsFromFling(1, perYear), 1);
  assert.equal(stepsFromFling(-1, perYear), -1);
  assert.equal(stepsFromFling(1000, perYear), P.flingMaxSteps, 'violent fling is capped');
  assert.equal(stepsFromFling(-1000, perYear), -P.flingMaxSteps);
});

test('pushSample keeps a bounded, ordered window', () => {
  const samples = [];
  for (let i = 0; i < 12; i++) pushSample(samples, { y: i, t: i });
  assert.equal(samples.length, P.flingSampleCount);
  assert.equal(samples.at(-1).y, 11, 'newest sample retained');
  assert.equal(samples.at(0).y, 12 - P.flingSampleCount, 'oldest dropped first');
});
