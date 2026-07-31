import test from 'node:test';
import assert from 'node:assert/strict';
import { installDom } from './helpers/dom.js';
import {
  captureResponsiveState,
  classifyViewportChange,
} from '../js/grid/responsive-layout.js';

const thresholds = { widthPx: 24, heightPx: 80, breakpoint: 600 };
const TOTAL_YEARS = 2000;

installDom();
const { GridArchitect } = await import('../js/grid/grid-architect.js');

function setViewportSize(width, height) {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: width });
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: height });
}

function makeGrid(width = 1280, height = 800) {
  installDom(`<!doctype html><body>
    <div id="ion-drive"></div>
    <nav id="year-nav" class="year-nav"><button data-nav="prev"></button></nav>
    <nav id="year-nav-end" class="year-nav"><button data-nav="next"></button></nav>
    <main id="viewport"><div id="infinite-canvas"></div></main>
  </body>`);
  setViewportSize(width, height);
  globalThis.IntersectionObserver = class {
    observe() {}
    unobserve() {}
  };
  window.matchMedia = () => ({
    matches: true,
    addEventListener() {},
    removeEventListener() {},
  });
  globalThis.matchMedia = window.matchMedia;

  const viewport = document.getElementById('viewport');
  Object.defineProperty(viewport, 'clientHeight', {
    configurable: true,
    get: () => window.innerHeight,
  });
  Object.defineProperty(viewport, 'scrollHeight', {
    configurable: true,
    get: () => TOTAL_YEARS * window.innerHeight,
  });

  let initialize;
  let particleResizes = 0;
  const noop = () => {};
  const grid = new GridArchitect({
    viewport,
    canvas: document.getElementById('infinite-canvas'),
    ionDrive: document.getElementById('ion-drive'),
    boot: { run: (callback) => { initialize = callback; } },
    theme: { toggle: noop },
    toast: { show: noop },
    audio: {
      play: noop,
      setBusy: noop,
      toggleMaster: () => false,
      enabled: false,
      injectEnginePower: noop,
      resetIdleTimer: noop,
      updateSpatialPosition: noop,
    },
    particles: {
      spawn: noop,
      resize: () => { particleResizes += 1; },
    },
  });

  const originalInterval = globalThis.setInterval;
  const originalTimeout = globalThis.setTimeout;
  globalThis.setInterval = () => 0;
  globalThis.setTimeout = () => 0;
  try {
    initialize();
  } finally {
    globalThis.setInterval = originalInterval;
    globalThis.setTimeout = originalTimeout;
  }

  return {
    grid,
    viewport,
    canvas: document.getElementById('infinite-canvas'),
    particleResizes: () => particleResizes,
  };
}

test('orientation and breakpoint changes are structural', () => {
  assert.equal(classifyViewportChange(
    { width: 1440, height: 900 },
    { width: 390, height: 844 },
    thresholds
  ), 'structural');
});

test('small mobile browser chrome movement does not rebuild', () => {
  assert.equal(classifyViewportChange(
    { width: 390, height: 844 },
    { width: 390, height: 805 },
    thresholds
  ), 'none');
});

test('material height movement without a structural change is height-only', () => {
  assert.equal(classifyViewportChange(
    { width: 390, height: 844 },
    { width: 390, height: 744 },
    thresholds
  ), 'height-only');
});

test('material width movement within one breakpoint is structural', () => {
  assert.equal(classifyViewportChange(
    { width: 1024, height: 768 },
    { width: 900, height: 768 },
    thresholds
  ), 'structural');
});

test('responsive state owns a clone of the focused date', () => {
  const focusedDate = new Date(2028, 1, 29);
  const state = captureResponsiveState({
    year: 2028,
    focusedDate,
    yearOffset: 137,
  });

  assert.deepEqual(state, {
    year: 2028,
    focusedDate: new Date(2028, 1, 29),
    yearOffset: 137,
  });
  assert.notEqual(state.focusedDate, focusedDate);
});

test('responsive state preserves an absent focus', () => {
  assert.deepEqual(captureResponsiveState({
    year: 2028,
    focusedDate: null,
    yearOffset: 0,
  }), {
    year: 2028,
    focusedDate: null,
    yearOffset: 0,
  });
});

test('grid reflow restores the active year, focused day, and year offset', () => {
  const { grid, viewport, canvas, particleResizes } = makeGrid();
  const year = Math.round(grid.currentYear);
  const focusedDate = new Date(year, 6, 15);

  grid.focusDate(focusedDate);
  const originalFocus = grid.focusedDate;
  assert.deepEqual(originalFocus, focusedDate);
  assert.notEqual(originalFocus, grid.focusedDate);

  viewport.scrollTop += 123;
  setViewportSize(390, 844);
  grid.reflowForViewport();

  const targetIndex = year - new Date().getFullYear() + TOTAL_YEARS / 2;
  assert.equal(grid.currentYear, year);
  assert.equal(viewport.scrollTop - targetIndex * 844, 123);
  assert.equal(canvas.style.height, `${TOTAL_YEARS * 844}px`);
  assert.deepEqual(grid.focusedDate, focusedDate);
  assert.equal(document.activeElement?.dataset.month, '6');
  assert.equal(document.activeElement?.dataset.date, '15');
  assert.equal(particleResizes(), 1);
});

test('grid reflow releases an interrupted travel lock', () => {
  const { grid, viewport } = makeGrid();
  grid.navigateYears(1);
  window.matchMedia = () => ({
    matches: false,
    addEventListener() {},
    removeEventListener() {},
  });

  grid.jumpToToday();
  assert.equal(viewport.classList.contains('is-locked'), true);

  grid.reflowForViewport();
  assert.equal(viewport.classList.contains('is-locked'), false);
});

test('resize ignores mobile chrome movement and coalesces structural changes', () => {
  const { grid, canvas, particleResizes } = makeGrid(390, 844);
  const year = grid.currentYear;
  const originalBlocks = [...canvas.children];
  const frames = [];
  const originalRaf = globalThis.requestAnimationFrame;
  const controlledRaf = (callback) => {
    frames.push(callback);
    return frames.length;
  };
  globalThis.requestAnimationFrame = controlledRaf;
  window.requestAnimationFrame = controlledRaf;

  try {
    setViewportSize(390, 805);
    window.dispatchEvent(new window.Event('resize'));
    assert.equal(frames.length, 1);
    frames.shift()(performance.now());

    assert.equal(particleResizes(), 0);
    assert.deepEqual([...canvas.children], originalBlocks);

    setViewportSize(700, 805);
    window.dispatchEvent(new window.Event('resize'));
    window.dispatchEvent(new window.Event('resize'));
    assert.equal(frames.length, 1);
    frames.shift()(performance.now());

    assert.equal(particleResizes(), 1);
    assert.equal(grid.currentYear, year);
  } finally {
    globalThis.requestAnimationFrame = originalRaf;
    window.requestAnimationFrame = originalRaf;
  }
});
