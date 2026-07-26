// TRACE App Bootstrap - Core Grid Only
// Minimal setup for grid rendering

import { COLOR_OF_YEAR, THEME_COLORS } from './config/theme-colors.js';
import { TraceEngine } from './core/trace-engine.js';
import { LocalePlugin } from './plugins/locale.plugin.js';
import { ThemePlugin } from './plugins/theme.plugin.js';

// Create engine instance - core grid rendering
const engine = new TraceEngine({
  themeColors: THEME_COLORS,
  colorOfYearMap: COLOR_OF_YEAR,
  viewport: document.getElementById('tr-viewport'),
  watermark: document.getElementById('tr-year-watermark'),
});

// Register only core plugins for grid rendering
engine.plugins.register('LocalePlugin', new LocalePlugin());
engine.plugins.register('ThemePlugin', new ThemePlugin());

// Expose for debugging
window.traceEngine = engine;
window.tracePlugins = engine.plugins;

console.log('[TRACE] ✨ Grid initialized');
