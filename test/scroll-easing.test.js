import test from 'node:test';
import assert from 'node:assert/strict';

import {
  durationForDistance,
  durationForPixels,
  durationForSteps,
  easeInOutCubic,
} from '../js/core/scroll-easing.js';

test('easeInOutCubic pins both ends and the midpoint', () => {
  assert.equal(easeInOutCubic(0), 0);
  assert.equal(easeInOutCubic(1), 1);
  assert.ok(Math.abs(easeInOutCubic(0.5) - 0.5) < 1e-9, 'symmetric about the middle');
});

test('easeInOutCubic is monotonic and stays inside 0..1', () => {
  let previous = -Infinity;
  for (let i = 0; i <= 100; i++) {
    const v = easeInOutCubic(i / 100);
    assert.ok(v >= previous, `dipped at t=${i / 100}`);
    assert.ok(v >= 0 && v <= 1, `left range at t=${i / 100}`);
    previous = v;
  }
});

test('easeInOutCubic clamps input outside 0..1', () => {
  assert.equal(easeInOutCubic(-5), 0);
  assert.equal(easeInOutCubic(5), 1);
});

test('easeInOutCubic starts and ends slowly', () => {
  assert.ok(easeInOutCubic(0.1) < 0.1, 'eases in');
  assert.ok(easeInOutCubic(0.9) > 0.9, 'eases out');
});

test('a nudge stays short and stops growing past three steps', () => {
  assert.equal(durationForSteps(1), 250);
  assert.equal(durationForSteps(2), 300);
  assert.equal(durationForSteps(3), 350);
  assert.equal(durationForSteps(50), 350, 'capped');
  assert.equal(durationForSteps(-50), 350, 'direction does not matter');
});

test('travel time grows with distance', () => {
  let previous = -1;
  for (const d of [1, 3, 5, 10, 20, 50, 100, 500, 1000]) {
    const ms = durationForDistance(d);
    assert.ok(ms > previous, `not increasing at distance ${d}`);
    previous = ms;
  }
});

test('the duration curve meets exactly at its segment joins', () => {
  // Each segment is defined so it starts where the previous one ended. A
  // mismatch here would be a real defect: two nearly equal distances would
  // animate for visibly different times.
  assert.equal(durationForDistance(5), 480);
  assert.equal(durationForDistance(20), 840);
  assert.equal(durationForDistance(100), 1320);
});

test('the curve never steps by more than one far-segment increment', () => {
  // Slope does change at 100, where the linear segments hand over to the
  // logarithmic one: that single 80ms step is deliberate — it marks the
  // boundary between "a few decades" and an interstellar jump. Anything
  // larger anywhere would be a bug.
  const MAX_STEP_MS = 80;
  for (let d = 1; d < 400; d++) {
    const step = durationForDistance(d + 1) - durationForDistance(d);
    assert.ok(step >= 0, `curve dipped between ${d} and ${d + 1}`);
    assert.ok(step <= MAX_STEP_MS, `jump of ${step}ms between ${d} and ${d + 1}`);
  }
});

test('travel time is capped so a millennium jump stays watchable', () => {
  assert.ok(durationForDistance(2000) <= 2400);
  assert.ok(durationForDistance(1_000_000) <= 2400);
});

test('zero distance takes no time, and direction is ignored', () => {
  assert.equal(durationForDistance(0), 0);
  assert.equal(durationForDistance(-30), durationForDistance(30));
});

test('durationForPixels converts through the step size', () => {
  assert.equal(durationForPixels(1000, 1000), durationForDistance(1));
  assert.equal(durationForPixels(10_000, 1000), durationForDistance(10));
  assert.equal(durationForPixels(-2500, 1000), durationForDistance(3), 'rounds up, sign-agnostic');
});

test('durationForPixels survives a zero step size', () => {
  assert.ok(Number.isFinite(durationForPixels(500, 0)));
});
