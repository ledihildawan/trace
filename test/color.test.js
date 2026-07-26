import test from 'node:test';
import assert from 'node:assert/strict';

import {
  FALLBACK_RGB,
  hexToRgb,
  parseColorString,
  splitLightDark,
} from '../js/core/color.js';

// Note: there is no DOM here, so the canvas colour probe is inactive and only
// the hex/rgb() fallbacks run. That is deliberate — these tests pin down the
// parts that must work without a browser. Modern colour syntax (oklch, lab,
// color()) is resolved by the browser's own parser at runtime.

test('splitLightDark separates the two branches', () => {
  assert.deepEqual(
    splitLightDark('light-dark(oklch(45.68% 0.2146 277.02), oklch(83.69% 0.1644 84.43))'),
    ['oklch(45.68% 0.2146 277.02)', 'oklch(83.69% 0.1644 84.43)']
  );
});

test('splitLightDark is not fooled by commas nested inside colour functions', () => {
  // A naive /light-dark\(([^,]+),([^)]+)\)/ cuts this at the first inner comma.
  assert.deepEqual(
    splitLightDark('light-dark(rgba(1, 2, 3, 0.5), #fff)'),
    ['rgba(1, 2, 3, 0.5)', '#fff']
  );
  assert.deepEqual(
    splitLightDark('light-dark(color-mix(in oklab, red 40%, blue), green)'),
    ['color-mix(in oklab, red 40%, blue)', 'green']
  );
});

test('splitLightDark handles slash alpha and rejects non-light-dark input', () => {
  assert.deepEqual(
    splitLightDark('light-dark(oklch(62.31% 0.188 259.81 / 0.6), blue)'),
    ['oklch(62.31% 0.188 259.81 / 0.6)', 'blue']
  );
  assert.equal(splitLightDark('#22d3ee'), null);
  assert.equal(splitLightDark('light-dark(red)'), null, 'no top-level comma');
  assert.equal(splitLightDark('  oklch(77% 0.15 84)  '), null);
});

test('hexToRgb accepts 3- and 6-digit forms and rejects junk', () => {
  assert.deepEqual(hexToRgb('#ffffff'), [1, 1, 1]);
  assert.deepEqual(hexToRgb('#000000'), [0, 0, 0]);
  assert.deepEqual(hexToRgb('#fff'), [1, 1, 1]);
  assert.deepEqual(hexToRgb('ff0000'), [1, 0, 0]);
  assert.equal(hexToRgb('#12345'), null);
  assert.equal(hexToRgb('#gggggg'), null);
});

test('parseColorString picks the light-dark branch matching the theme', () => {
  const value = 'light-dark(#ff0000, #0000ff)';
  assert.deepEqual(parseColorString(value, true), [1, 0, 0]);
  assert.deepEqual(parseColorString(value, false), [0, 0, 1]);
});

test('parseColorString reads rgb() and rgba() in both comma and space form', () => {
  assert.deepEqual(parseColorString('rgb(255, 0, 0)'), [1, 0, 0]);
  assert.deepEqual(parseColorString('rgba(0, 0, 255, 0.5)'), [0, 0, 1]);
  assert.deepEqual(parseColorString('rgb(255 0 0)'), [1, 0, 0]);
});

test('parseColorString degrades to neutral grey instead of throwing', () => {
  assert.deepEqual(parseColorString(''), FALLBACK_RGB);
  assert.deepEqual(parseColorString(null), FALLBACK_RGB);
  assert.deepEqual(parseColorString('not-a-colour'), FALLBACK_RGB);
});
