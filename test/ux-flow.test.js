import test from 'node:test';
import assert from 'node:assert/strict';
import { installDom, fire } from './helpers/dom.js';
import { DayStore } from '../js/systems/day-store.js';
import { DayPanel } from '../js/ui/day-panel.js';
import { GridArchitect } from '../js/grid/grid-architect.js';
import { Onboarding } from '../js/ui/onboarding.js';
import { AdaptiveDock } from '../js/ui/adaptive-dock.js';

function bootTestApp({ width = 1440, height = 900 } = {}) {
  installDom(`<!doctype html><body>
    <div id="ion-drive"></div>
    <nav id="year-nav" class="year-nav"><button data-nav="prev"></button></nav>
    <nav id="year-nav-end" class="year-nav"><button data-nav="next"></button></nav>
    <nav id="adaptive-dock" aria-label="Tindakan utama">
      <button data-action="today">Hari ini</button>
      <button data-action="search">Cari</button>
      <button data-action="menu">Menu</button>
    </nav>
    <main id="viewport"><div id="infinite-canvas"></div></main>
  </body>`);

  Object.defineProperty(window, 'innerWidth', { configurable: true, value: width });
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: height });
  globalThis.IntersectionObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
  globalThis.matchMedia = window.matchMedia;

  const viewport = document.getElementById('viewport');
  Object.defineProperty(viewport, 'clientHeight', { configurable: true, value: height });
  Object.defineProperty(viewport, 'scrollHeight', { configurable: true, value: 1600000 });

  const store = new DayStore();
  const dayPanel = new DayPanel(store, { confirmDelete: () => true });

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

  const onboarding = new Onboarding({
    storage: localStorage,
    storageKey: 'trace-onboarding-v1-test',
    onOpen: () => dock.pin(),
    onClose: () => dock.unpin(),
  });
  const dock = new AdaptiveDock({
    target: window,
    idleMs: 50,
    onToday: () => grid.jumpToToday(),
    onSearch: () => grid.openSearch(),
    onMenu: () => {},
  });

  return {
    store,
    dayPanel,
    grid,
    onboarding,
    dock,
    resizeTo(w, h) {
      Object.defineProperty(window, 'innerWidth', { configurable: true, value: w });
      Object.defineProperty(window, 'innerHeight', { configurable: true, value: h });
      Object.defineProperty(viewport, 'clientHeight', { configurable: true, value: h });
      grid.reflowForViewport();
    },
    initializeGrid() {
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
    },
  };
}

test('first run can discover and record a day', () => {
  const app = bootTestApp();
  app.initializeGrid();

  app.onboarding.showFirstRun();
  assert.equal(app.onboarding.isOpen(), true, 'onboarding opens on first run');
  document.querySelector('[data-action="start"]').click();
  assert.equal(app.onboarding.isOpen(), false, 'onboarding closes after start');
  assert.equal(app.onboarding.hasCompleted, true, 'onboarding marked complete');

  app.dock.show();
  document.querySelector('[data-action="today"]').click();

  app.dayPanel.open(new Date(2026, 6, 31));
  assert.equal(app.dayPanel.isOpen(), true, 'day panel opens');

  const textarea = document.querySelector('.day-panel-note');
  textarea.value = 'Hari yang baik';
  fire(textarea, 'input');
  app.store.flush();

  const entry = app.store.get('2026-07-31');
  assert.ok(entry, 'entry exists for 2026-07-31');
  assert.equal(entry.note, 'Hari yang baik', 'note is recorded');
});

test('responsive reflow retains active year and focused date', () => {
  const app = bootTestApp();
  app.initializeGrid();

  app.grid.focusDate(new Date(2026, 6, 31));
  assert.equal(app.grid.currentYear, 2026, 'year is 2026 before resize');
  assert.equal(DayStore.keyOf(app.grid.focusedDate), '2026-07-31', 'focus is on 2026-07-31');

  app.resizeTo(390, 844);

  assert.equal(app.grid.currentYear, 2026, 'year is still 2026 after resize');
  assert.equal(DayStore.keyOf(app.grid.focusedDate), '2026-07-31', 'focus retained after resize');
});

test('search opens and can be closed', () => {
  const app = bootTestApp();
  app.initializeGrid();

  app.store.setNote('2026-07-31', 'Test note');
  app.store.flush();

  app.dock.show();
  document.querySelector('[data-action="search"]').click();

  const searchDialog = document.querySelector('.note-search');
  assert.ok(searchDialog?.open, 'search dialog opens');

  searchDialog.close();
  assert.ok(!searchDialog?.open, 'search dialog closes');
});
