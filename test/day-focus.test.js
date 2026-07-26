import test from 'node:test';
import assert from 'node:assert/strict';
import { installDom } from './helpers/dom.js';

installDom();

const { DayFocus } = await import('../js/grid/day-focus.js');
const { buildYearCellsHTML, buildGridLayer, computeGridCols, computeYearOffset } =
  await import('../js/grid/grid-renderer.js');
const { daysInYear, stampOf } = await import('../js/core/date-utils.js');

const TODAY = new Date(2026, 6, 27);
const COLS = computeGridCols(1920, 1080);

// Builds a real year block, the same markup the app renders.
function buildBlock(year) {
  const offset = computeYearOffset(year, COLS, true);
  const rows = Math.ceil((daysInYear(year) + offset) / COLS);
  const block = document.createElement('section');
  block.className = 'year-block';
  block.dataset.year = String(year);
  const grid = buildGridLayer(year, COLS, rows, false);
  grid.innerHTML = buildYearCellsHTML(year, COLS, rows, offset, stampOf(TODAY), true);
  block.append(grid);
  document.body.append(block);
  return block;
}

function setup(years = [2026]) {
  document.body.replaceChildren();
  const canvas = document.createElement('div');
  document.body.append(canvas);
  const blocks = new Map(years.map((y) => [y, buildBlock(y)]));
  blocks.forEach((b) => canvas.append(b));
  const focus = new DayFocus(canvas, {
    resolveBlock: (year) => blocks.get(year),
    today: TODAY,
  });
  return { focus, blocks, canvas };
}

const cellFor = (block, month, date) =>
  block.querySelector(`.cell[data-month="${month}"][data-date="${date}"]`);

const tabStops = (root) => [...root.querySelectorAll('.cell[tabindex="0"]')];

test('focusing a cell adopts its date', () => {
  const { focus, blocks } = setup();
  const cell = cellFor(blocks.get(2026), 6, 27);
  cell.focus();

  assert.equal(focus.cell, cell);
  assert.equal(focus.date.getFullYear(), 2026);
  assert.equal(focus.date.getMonth(), 6);
  assert.equal(focus.date.getDate(), 27);
});

test('focus arriving on a filler cell is ignored', () => {
  const { focus, blocks } = setup();
  const filler = blocks.get(2026).querySelector('.cell.filler');
  assert.ok(filler, 'the fixture needs at least one filler cell');
  filler.dispatchEvent(new window.Event('focusin', { bubbles: true }));
  assert.equal(focus.date, null, 'filler days carry no date');
});

test('exactly one cell is in the tab order, and it follows focus', () => {
  const { focus, blocks, canvas } = setup();
  const block = blocks.get(2026);

  focus.refreshTabStop(2026);
  assert.equal(tabStops(canvas).length, 1, 'one tab stop after the first pass');

  cellFor(block, 0, 15).focus();
  assert.equal(tabStops(canvas).length, 1, 'still exactly one after moving');
  assert.equal(tabStops(canvas)[0], cellFor(block, 0, 15));

  cellFor(block, 11, 3).focus();
  assert.equal(tabStops(canvas).length, 1);
  assert.equal(tabStops(canvas)[0], cellFor(block, 11, 3));
});

test('the tab stop prefers today when nothing is focused yet', () => {
  const { focus, canvas, blocks } = setup();
  focus.refreshTabStop(2026);
  assert.equal(tabStops(canvas)[0], cellFor(blocks.get(2026), 6, 27), 'today');
});

test('the tab stop falls back to the first day of a year that is not today', () => {
  const { focus, canvas, blocks } = setup([2030]);
  focus.refreshTabStop(2030);
  const stop = tabStops(canvas)[0];
  assert.ok(stop, 'a year with no today still needs a tab stop');
  assert.equal(stop.dataset.month, '0');
  assert.equal(stop.dataset.date, '1');
});

test('the tab stop moves to the year the user is looking at', () => {
  const { focus, canvas, blocks } = setup([2026, 2027]);
  focus.refreshTabStop(2026);
  assert.equal(tabStops(canvas)[0].closest('.year-block').dataset.year, '2026');

  focus.refreshTabStop(2027);
  assert.equal(tabStops(canvas).length, 1, 'the old stop was released');
  assert.equal(tabStops(canvas)[0].closest('.year-block').dataset.year, '2027');
});

test('refreshing for a year that is not rendered leaves the stop alone', () => {
  const { focus, canvas } = setup();
  focus.refreshTabStop(2026);
  const before = tabStops(canvas)[0];
  focus.refreshTabStop(1999);
  assert.equal(tabStops(canvas)[0], before);
});

test('focusIn moves focus and reports whether the day existed', () => {
  const { focus, blocks } = setup();
  const block = blocks.get(2026);
  assert.equal(focus.focusIn(block, new Date(2026, 2, 14)), true);
  assert.equal(document.activeElement, cellFor(block, 2, 14));
  assert.equal(focus.focusIn(block, new Date(2027, 2, 14)), false, 'not in this block');
});

test('isCellFocused is true only while a real day holds focus', () => {
  const { focus, blocks } = setup();
  const block = blocks.get(2026);
  assert.equal(focus.isCellFocused(), false, 'nothing focused yet');

  const cell = cellFor(block, 6, 27);
  cell.focus();
  assert.equal(focus.isCellFocused(), true);

  cell.blur();
  assert.equal(focus.isCellFocused(), false, 'focus left the grid');
});

test('filler cells cannot take focus at all', () => {
  // They render without tabindex, which is what keeps empty leading and
  // trailing days out of the keyboard path.
  const { blocks } = setup();
  const filler = blocks.get(2026).querySelector('.cell.filler');
  assert.equal(filler.hasAttribute('tabindex'), false);

  const before = document.activeElement;
  filler.focus();
  assert.equal(document.activeElement, before, 'focus did not move');
});

test('restoreFocus returns focus to the last focused day', () => {
  const { focus, blocks } = setup();
  const cell = cellFor(blocks.get(2026), 6, 27);
  cell.focus();
  cell.blur();

  focus.restoreFocus();
  assert.equal(document.activeElement, cell);
});
