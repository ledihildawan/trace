// TRACE App Bootstrap: framework-agnostic initialization
// Centralizes engine creation and page lifecycle wiring

import { COLOR_OF_YEAR, THEME_COLORS } from './theme.js';
import { TraceEngine } from './trace-engine.js';

const engine = new TraceEngine({
  themeColors: THEME_COLORS,
  colorOfYearMap: COLOR_OF_YEAR,
  viewport: document.getElementById('tr-viewport'),
  watermark: document.getElementById('tr-year-watermark'),
  tooltip: document.getElementById('tr-tooltip'),
  announcer: document.getElementById('tr-a11y-announcer'),
  srStatus: document.getElementById('tr-sr-status'),
});

window.addEventListener(
  'pagehide',
  () => {
    engine.destroy();
  },
  { once: true }
);
// Expose for debugging via console
window.traceEngine = engine;
