import test from 'node:test';
import assert from 'node:assert/strict';
import { installDom } from './helpers/dom.js';
import { GridArchitect } from '../js/grid/grid-architect.js';
import { AppMenu } from '../js/ui/app-menu.js';

function makeGrid() {
  installDom(`<!doctype html><body>
    <div id="ion-drive"></div>
    <nav id="year-nav" class="year-nav"><button data-nav="prev"></button></nav>
    <nav id="year-nav-end" class="year-nav"><button data-nav="next"></button></nav>
    <main id="viewport"><div id="infinite-canvas"></div></main>
  </body>`);
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1280 });
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: 800 });
  globalThis.IntersectionObserver = class {
    observe() {}
    unobserve() {}
  };
  window.matchMedia = () => ({ matches: true, addEventListener() {}, removeEventListener() {} });
  globalThis.matchMedia = window.matchMedia;
  const viewport = document.getElementById('viewport');
  Object.defineProperty(viewport, 'clientHeight', { configurable: true, value: 800 });
  Object.defineProperty(viewport, 'scrollHeight', { configurable: true, value: 1600000 });

  let initialize;
  const boot = { run: (callback) => { initialize = callback; } };
  const noop = () => {};
  const grid = new GridArchitect({
    viewport,
    canvas: document.getElementById('infinite-canvas'),
    ionDrive: document.getElementById('ion-drive'),
    boot,
    theme: { toggle: noop },
    toast: { show: noop },
    audio: { play: noop, setBusy: noop, toggleMaster: () => false, enabled: false },
    particles: { spawn: noop, resize: noop, injectEnginePower: noop, resetIdleTimer: noop, updateSpatialPosition: noop },
  });
  return { grid, initialize };
}

function initializeGrid(initialize) {
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
}

test('grid public state waits for boot, deduplicates its year, and follows R', () => {
  const { grid, initialize } = makeGrid();
  const years = [];
  grid.onYearChange((year) => years.push(year));
  assert.deepEqual(years, []);

  initializeGrid(initialize);
  const expected = new Date().getFullYear();
  assert.deepEqual(years, [expected]);
  grid.jumpToToday();
  assert.deepEqual(years, [expected]);
  document.body.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'r', bubbles: true }));
  assert.equal(grid.layout, 'dynamic');

  const menu = new AppMenu({
    getLayout: () => grid.layout,
    onLayout: (mode) => grid.setLayout(mode),
  });
  menu.open();
  assert.match(menu.element.querySelector('[data-status="layout"]').textContent, /Dinamis/);
  menu.element.querySelector('[data-action="layout"]').click();
  assert.equal(grid.layout, 'structured');
});
