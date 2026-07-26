import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildYearCellsHTML,
  computeGridCols,
  computeYearOffset,
} from '../js/grid/grid-renderer.js';
import { daysInYear, stampOf } from '../js/core/date-utils.js';

// A "detailed" year at desktop proportions — the common case.
const COLS = computeGridCols(1920, 1080);
const TODAY = stampOf(new Date(2026, 6, 27)); // Mon 27 Jul 2026

function renderYear(year, detailed = true) {
  const offset = computeYearOffset(year, COLS, true);
  const rows = Math.ceil((daysInYear(year) + offset) / COLS);
  return {
    rows,
    offset,
    html: buildYearCellsHTML(year, COLS, rows, offset, TODAY, detailed),
  };
}

const count = (html, re) => (html.match(re) || []).length;

test('grid columns stay a multiple of the week length', () => {
  for (const [w, h] of [[1920, 1080], [1280, 800], [2560, 1440], [800, 600]]) {
    assert.equal(computeGridCols(w, h) % 7, 0, `${w}x${h} should tile whole weeks`);
  }
  assert.equal(computeGridCols(390, 844), 7, 'narrow viewports fall back to one week per row');
});

test('structured mode aligns 1 January to its Monday-based weekday', () => {
  for (const year of [2024, 2025, 2026, 2027]) {
    const expected = (new Date(year, 0, 1).getDay() + 6) % 7;
    assert.equal(computeYearOffset(year, COLS, true), expected);
  }
});

test('a rendered year emits exactly one cell per grid slot', () => {
  for (const year of [2024, 2025, 2026, 1900, 2100]) {
    const { html, rows } = renderYear(year);
    assert.equal(count(html, /role="row"/g), rows, `${year}: row count`);
    assert.equal(count(html, /class="cell[ "]/g), COLS * rows, `${year}: cell count`);
  }
});

test('every real day carries the data attributes the app reads', () => {
  // Regression guard: these were missing from the detailed path, which broke
  // click-to-focus, keyboard day navigation and the note/mood markers.
  for (const year of [2024, 2026]) {
    const { html } = renderYear(year);
    const days = daysInYear(year);
    assert.equal(count(html, /data-month="/g), days, `${year}: data-month`);
    assert.equal(count(html, /data-day="/g), days, `${year}: data-day`);
    assert.equal(count(html, /data-date="/g), days, `${year}: data-date`);
    assert.equal(count(html, /data-is-month-start="/g), days, `${year}: data-is-month-start`);
    assert.equal(count(html, /role="gridcell"/g), days, `${year}: gridcell role`);
    assert.equal(count(html, /tabindex="-1"/g), days, `${year}: focusable`);
    assert.equal(count(html, /class="[^"]*month-start/g), 12, `${year}: one month-start per month`);
  }
});

test('date-only cells still carry data attributes and are not marked enriched', () => {
  const { html } = renderYear(2026, false);
  assert.equal(count(html, /data-month="/g), 365);
  assert.ok(!html.includes('enriched'), 'minimal cells must be left for enrichment');
  assert.ok(!html.includes('info-meta'), 'minimal cells carry no labels yet');

  const detailed = renderYear(2026, true).html;
  assert.ok(detailed.includes('enriched'), 'detailed cells are already final');
  assert.ok(detailed.includes('info-meta'));
});

test('today is marked exactly once, on the right day', () => {
  const { html } = renderYear(2026);
  assert.equal(count(html, /aria-current="date"/g), 1);
  assert.match(html, /data-month="6" data-day="1" data-date="27"/);
});

test('day cells are labelled in Indonesian for screen readers', () => {
  const { html } = renderYear(2026);
  assert.ok(html.includes('aria-label="Senin, 27 Juli 2026"'));
  assert.ok(html.includes('aria-label="Kamis, 1 Januari 2026"'));
});

test('filler cells are hidden from assistive tech and hold no date data', () => {
  const { html, offset } = renderYear(2026);
  assert.ok(offset > 0, '2026 needs leading filler to reach its Monday offset');
  assert.equal(count(html, /data-is-filler="true"/g), COLS * renderYear(2026).rows - 365);
  const firstCell = html.slice(html.indexOf('<div class="cell'));
  assert.ok(firstCell.startsWith('<div class="cell filler"'));
  assert.ok(html.includes('aria-hidden="true"'));
});
