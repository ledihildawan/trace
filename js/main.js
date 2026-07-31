import { OdysseyConfig } from './config/odyssey-config.js';
import { TemporalLabels } from './core/locale.js';
import { UI_COPY } from './core/ui-copy.js';
import { ThemeController } from './ui/theme-controller.js';
import { ToastManager } from './ui/toast-manager.js';
import { BootSequence } from './ui/boot-sequence.js';
import { KeyboardHints } from './ui/keyboard-hints.js';
import { AdaptiveDock } from './ui/adaptive-dock.js';
import { AppMenu } from './ui/app-menu.js';
import { Onboarding } from './ui/onboarding.js';
import { YearContext } from './ui/year-context.js';
import { DataActions } from './ui/data-actions.js';
import { ParticleEngine } from './systems/particle-engine.js';
import { GalacticAudio } from './systems/galactic-audio.js';
import { GridArchitect } from './grid/grid-architect.js';

const TAG = '[TRACE]';
const log = (...a) => console.log(TAG, ...a);
const warn = (...a) => console.warn(TAG, ...a);

// No-op stand-in for optional systems (audio/particles) so the grid keeps
// working even when WebGL or the AudioContext are unavailable.
const STUB = {
  spawn() {},
  resize() {},
  play() {},
  toggleMaster() { return false; },
  injectEnginePower() {},
  resetIdleTimer() {},
  setBusy() {},
  updateSpatialPosition() {},
  setMasterVolume() {},
  get enabled() { return false; },
};

// Construct a system, falling back to `fallback` (or undefined) if it throws.
function safe(label, factory, fallback) {
  try {
    return factory();
  } catch (err) {
    warn(`${label} unavailable — degrading.`, err);
    return fallback;
  }
}

// The renderer indexes these arrays for every cell, so a missing one surfaces
// as a cryptic "cannot read properties of undefined" ~400 levels into a render
// loop. Check the shape up front and say exactly what is wrong instead.
const REQUIRED_TEMPORAL = {
  monthsShort: 12,
  monthsFull: 12,
  daysShort: 7,
  daysFull: 7,
};

function assertConfig() {
  const problems = [];
  for (const [key, len] of Object.entries(REQUIRED_TEMPORAL)) {
    const v = TemporalLabels[key];
    if (!Array.isArray(v)) problems.push(`${key} is ${v === undefined ? 'missing' : typeof v}`);
    else if (v.length !== len) problems.push(`${key} has ${v.length} entries, expected ${len}`);
    else if (v.some((label) => !label)) problems.push(`${key} contains an empty label`);
  }
  if (!problems.length) return;

  warn(
    `Locale data for "${OdysseyConfig.temporal.locale}" is unusable:\n  - ${problems.join('\n  - ')}\n` +
    'This normally means the platform has no ICU data for that locale.'
  );
  warn('resolved labels:', TemporalLabels);
  throw new Error(`${TAG} Invalid locale data: ${problems.join('; ')}`);
}

function hideLoading() {
  const screen = document.getElementById(OdysseyConfig.dom.loadingScreen);
  if (screen) screen.classList.add(OdysseyConfig.classes.hidden);
}

function showOnboardingAfterBoot(onboarding, screen) {
  if (!onboarding || !screen) return;
  const show = () => onboarding.showFirstRun();
  if (screen.classList.contains(OdysseyConfig.classes.hidden)) {
    show();
    return;
  }
  const observer = new MutationObserver(() => {
    if (!screen.classList.contains(OdysseyConfig.classes.hidden)) return;
    observer.disconnect();
    show();
  });
  observer.observe(screen, { attributes: true, attributeFilter: ['class'] });
}

function bootstrap() {
  assertConfig();
  const dom = OdysseyConfig.dom;
  const status = document.getElementById(dom.loadStatus);
  if (status) status.textContent = UI_COPY.loading;
  const viewport = document.getElementById(dom.viewport);
  const canvas = document.getElementById(dom.infiniteCanvas);
  const ionDrive = document.getElementById(dom.ionDrive);

  if (!viewport || !canvas || !ionDrive) {
    if (status) status.textContent = 'Critical DOM missing.';
    hideLoading();
    throw new Error(`${TAG} Required DOM nodes missing. Aborting.`);
  }

  const theme = safe('ThemeController', () => new ThemeController());
  const toast = safe('ToastManager', () => new ToastManager());
  const boot = safe('BootSequence', () => new BootSequence());
  const hints = safe('KeyboardHints', () => new KeyboardHints());
  const particles = safe('ParticleEngine', () => new ParticleEngine(), STUB);
  const audio = safe('GalacticAudio', () => new GalacticAudio(), STUB);

  // Menu and dock callbacks close over this small composition state rather
  // than relying on window globals or construction order.
  const ui = { grid: null, menu: null, onboarding: null, yearContext: null };
  const dock = safe('AdaptiveDock', () => new AdaptiveDock({
    idleMs: OdysseyConfig.timing.dockIdleMs,
    coarseQuery: OdysseyConfig.timing.cursorCoarseQuery,
    onToday: () => ui.grid?.jumpToToday(),
    onSearch: () => ui.grid?.openSearch?.(),
    onMenu: () => ui.menu?.open?.(),
  }));
  const onboarding = safe('Onboarding', () => new Onboarding({
    storageKey: dom.onboardingStorageKey,
    onOpen: () => dock?.pin?.(),
    onClose: () => dock?.unpin?.(),
  }));
  const grid = safe('GridArchitect', () =>
    new GridArchitect({ viewport, canvas, ionDrive, theme, toast, boot, audio, particles })
  );
  ui.grid = grid;
  const dataActions = new DataActions(grid?.store ?? {}, {
    onUpdate: (result) => {
      if (result?.error) toast?.show?.('IMPORT FAILED');
      else if (result) toast?.show?.(`${result.imported} diperbarui · ${result.preserved} dipertahankan · ${result.skipped} dilewati`);
    },
  });
  ui.onboarding = onboarding;
  const yearContext = safe('YearContext', () => new YearContext({
    onPrevious: () => ui.grid?.navigateYears?.(-1),
    onNext: () => ui.grid?.navigateYears?.(1),
  }));
  ui.yearContext = yearContext;
  grid?.onYearChange?.((year) => yearContext?.setYear(year));
  const menu = safe('AppMenu', () => new AppMenu({
    onTheme: () => theme?.toggle?.(),
    onAudio: () => audio?.toggleMaster?.(),
    onLayout: (mode) => {
      grid?.setLayout?.(mode);
      return mode;
    },
    // Task 8 supplies the data subsection. Its action intentionally keeps
    // this dialog open so that subsection can take over in place.
    onData: () => dataActions?.open?.(),
    onHelp: () => onboarding?.open?.(),
    onOpen: () => dock?.pin?.(),
    onClose: () => dock?.unpin?.(),
    getTheme: () => theme?.current,
    getAudio: () => audio?.enabled,
    getLayout: () => grid?.layout,
  }));
  ui.menu = menu;
  showOnboardingAfterBoot(onboarding, document.getElementById(dom.loadingScreen));

  hints?.start?.();
  window.trace = { audio, particles, theme, grid, dock, onboarding, menu, yearContext, ui, config: OdysseyConfig };
  log('Modular system initialized');
}

// Never leave the user on the loading screen, even if bootstrap throws.
try {
  bootstrap();
} catch (err) {
  warn('Bootstrap failed.', err);
  // A fatal boot error leaves nothing usable behind, so keep the loading
  // screen up with the reason on it rather than revealing an empty grid.
  const status = document.getElementById(OdysseyConfig.dom.loadStatus);
  if (status) status.textContent = err?.message ?? 'Boot failed.';
  else hideLoading();
}
