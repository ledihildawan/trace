// TRACE App Bootstrap: framework-agnostic initialization
// Plugin-based architecture with hot-reload support

import { COLOR_OF_YEAR, THEME_COLORS } from './config/theme-colors.js';
import { TraceEngine } from './core/trace-engine.js';

// Import all plugins
import { A11yPlugin } from './plugins/a11y.plugin.js';
import { DevToolsPlugin } from './plugins/devtools.plugin.js';
import { InteractionPlugin } from './plugins/interaction.plugin.js';
import { LocalePlugin } from './plugins/locale.plugin.js';
import { TimeProgressPlugin } from './plugins/progress.plugin.js';
import { ThemePlugin } from './plugins/theme.plugin.js';
import { TooltipPlugin } from './plugins/tooltip.plugin.js';

// Create engine instance
const engine = new TraceEngine({
  themeColors: THEME_COLORS,
  colorOfYearMap: COLOR_OF_YEAR,
  viewport: document.getElementById('tr-viewport'),
  watermark: document.getElementById('tr-year-watermark'),
  tooltip: document.getElementById('tr-tooltip'),
  announcer: document.getElementById('tr-a11y-announcer'),
  srStatus: document.getElementById('tr-sr-status'),
});

// Register plugins in order
// Core plugins (required for basic functionality)
engine.plugins.register('LocalePlugin', new LocalePlugin());
engine.plugins.register('ThemePlugin', new ThemePlugin());
engine.plugins.register('A11yPlugin', new A11yPlugin());
engine.plugins.register('TooltipPlugin', new TooltipPlugin());

// Feature plugins (can be disabled/enabled)
engine.plugins.register('InteractionPlugin', new InteractionPlugin());
engine.plugins.register('TimeProgressPlugin', new TimeProgressPlugin());
engine.plugins.register('DevToolsPlugin', new DevToolsPlugin());

// Initialize engine after plugins are registered
engine.init();
engine.render();

// Enable hot-reload in development
if (import.meta.env?.DEV || location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
  engine.plugins.enableHotReload();
  console.log('[TRACE] 🔥 Hot-reload enabled. Use window.traceReloadPlugin(name) to reload plugins.');
}

// Cleanup on page hide
window.addEventListener(
  'pagehide',
  () => {
    engine.destroy();
  },
  { once: true }
);

// Expose for debugging via console
window.traceEngine = engine;
window.tracePlugins = engine.plugins;

console.log('[TRACE] ✨ Initialized with plugins:', engine.plugins.list());
