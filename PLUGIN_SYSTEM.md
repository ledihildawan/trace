# TRACE Plugin System

## Overview

TRACE now uses a modular plugin architecture that separates core functionality from optional features. This makes the codebase more maintainable, testable, and extensible.

## Architecture

```
js/
├── core/                    # Core engine (minimal, stable)
│   ├── trace-engine.js      # Main engine (grid, render, time)
│   ├── plugin-manager.js    # Plugin registration & hot-reload
│   ├── constants.js         # Shared constants
│   └── utils.js             # Pure utility functions
│
├── plugins/                 # Feature plugins (modular)
│   ├── theme.plugin.js      # Theme management
│   ├── locale.plugin.js     # Internationalization
│   ├── tooltip.plugin.js    # Tooltip system
│   ├── interaction.plugin.js # User interactions
│   ├── progress.plugin.js   # Time progress updates
│   ├── devtools.plugin.js   # Development features
│   └── a11y.plugin.js       # Accessibility
│
├── config/                  # Configuration data
│   └── theme-colors.js      # Theme palettes
│
└── app.js                   # Bootstrap & plugin loading
```

## Plugin Types

### Core Plugins (Required)
- **LocalePlugin** - i18n, date formatting, translations
- **ThemePlugin** - Color management, theme switching
- **A11yPlugin** - Accessibility, ARIA attributes

### Feature Plugins (Optional)
- **TooltipPlugin** - Tooltip display and positioning
- **InteractionPlugin** - Mouse, touch, keyboard interactions
- **TimeProgressPlugin** - Real-time progress updates
- **DevToolsPlugin** - Testing utilities (randomize, simulate time)

## Creating a Custom Plugin

### 1. Basic Plugin Structure

```javascript
// plugins/my-custom.plugin.js
import { TracePlugin } from '../core/plugin-manager.js';

export class MyCustomPlugin extends TracePlugin {
  constructor() {
    super('MyCustomPlugin');
    // Initialize state
    this.myState = null;
  }

  init(engine) {
    super.init(engine);
    // Access engine instance
    console.log('Engine year:', engine.year);
    
    // Setup event listeners (auto-cleanup via signal)
    window.addEventListener('keydown', this.handleKey, { signal: this.signal });
  }

  handleKey = (e) => {
    if (e.key === 'm') {
      console.log('Custom plugin triggered!');
    }
  }

  // Optional: called when engine renders
  onRender() {
    console.log('Grid re-rendered');
  }

  // Optional: called when theme changes
  onThemeChange() {
    console.log('Theme changed');
  }

  destroy() {
    // Cleanup (event listeners auto-removed via AbortController)
    super.destroy();
  }
}
```

### 2. Register Your Plugin

```javascript
// app.js
import { MyCustomPlugin } from './plugins/my-custom.plugin.js';

// After engine creation
engine.plugins.register('MyCustomPlugin', new MyCustomPlugin());
```

### 3. Access Plugin from Other Plugins

```javascript
// Inside another plugin
const myPlugin = this.engine.plugins.get('MyCustomPlugin');
if (myPlugin) {
  myPlugin.doSomething();
}
```

## Plugin API

### TracePlugin Base Class

```javascript
class TracePlugin {
  // Constructor
  constructor(name: string)
  
  // Initialize with engine instance
  init(engine: TraceEngine)
  
  // Get AbortSignal for auto-cleanup
  get signal(): AbortSignal
  
  // Cleanup resources
  destroy()
  
  // Lifecycle hooks
  onRender()        // Called after each render
  onThemeChange()   // Called when theme changes
}
```

### PluginManager API

```javascript
class PluginManager {
  // Register a plugin
  register(name: string, plugin: TracePlugin)
  
  // Unregister a plugin
  unregister(name: string)
  
  // Get plugin instance
  get(name: string): TracePlugin | undefined
  
  // Check if plugin exists
  has(name: string): boolean
  
  // List all plugin names
  list(): string[]
  
  // Enable hot-reload (dev only)
  enableHotReload()
  
  // Reload specific plugin
  reload(name: string)
  
  // Reload all plugins
  reloadAll()
  
  // Destroy all plugins
  destroyAll()
}
```

### Engine API (Available in Plugins)

```javascript
// Access via this.engine in plugins
class TraceEngine {
  // State
  year: number
  todayStr: string
  todayTime: number
  colorIndex: number
  
  // DOM elements
  viewport: HTMLElement
  watermark: HTMLElement
  tooltip: HTMLElement
  announcer: HTMLElement
  srStatus: HTMLElement
  
  // Configuration
  themeColors: string[]
  colorOfYearMap: Record<number, string>
  
  // Methods
  getNow(): Date
  applyNow(date: Date)
  render()
  destroy()
  
  // Plugin manager
  plugins: PluginManager
}
```

## Hot-Reload (Development)

Hot-reload is automatically enabled in development mode (localhost).

### Using Hot-Reload

```javascript
// In browser console:

// Reload specific plugin
window.traceReloadPlugin('ThemePlugin')

// Reload all plugins
window.traceReloadAllPlugins()

// List active plugins
window.tracePlugins.list()

// Get plugin instance
window.tracePlugins.get('ThemePlugin')
```

### Plugin Order

Plugins are loaded in this order:
1. LocalePlugin (provides i18n)
2. ThemePlugin (provides theming)
3. A11yPlugin (provides accessibility)
4. TooltipPlugin (depends on locale)
5. InteractionPlugin (depends on theme, tooltip)
6. TimeProgressPlugin (standalone)
7. DevToolsPlugin (depends on all)

## Best Practices

### 1. Use AbortController for Cleanup

```javascript
init(engine) {
  super.init(engine);
  
  // Use this.signal for automatic cleanup
  window.addEventListener('resize', this.handleResize, { signal: this.signal });
}
```

### 2. Check Plugin Dependencies

```javascript
init(engine) {
  super.init(engine);
  
  const localePlugin = engine.plugins.get('LocalePlugin');
  if (!localePlugin) {
    console.warn('LocalePlugin not found');
    return;
  }
}
```

### 3. Avoid Tight Coupling

```javascript
// ❌ Bad: Direct access
const text = engine.plugins.get('LocalePlugin')._t.backToRealTime;

// ✅ Good: Through public API
const localePlugin = engine.plugins.get('LocalePlugin');
const text = localePlugin?.translate('backToRealTime') ?? 'Back to real time';
```

### 4. Provide Public API

```javascript
export class MyPlugin extends TracePlugin {
  // Private state
  #privateState = {};
  
  // Public method
  doSomething() {
    return this.#privateState;
  }
  
  // Public property
  get isReady() {
    return this.#privateState !== null;
  }
}
```

## Example: Analytics Plugin

```javascript
// plugins/analytics.plugin.js
import { TracePlugin } from '../core/plugin-manager.js';

export class AnalyticsPlugin extends TracePlugin {
  constructor() {
    super('AnalyticsPlugin');
    this.events = [];
  }

  init(engine) {
    super.init(engine);
    
    // Track theme changes
    const themePlugin = engine.plugins.get('ThemePlugin');
    if (themePlugin) {
      const originalSetTheme = themePlugin.setThemeIndex.bind(themePlugin);
      themePlugin.setThemeIndex = (index, options) => {
        this.track('theme_change', { index });
        return originalSetTheme(index, options);
      };
    }
  }

  track(eventName, data = {}) {
    this.events.push({
      name: eventName,
      data,
      timestamp: Date.now()
    });
    console.log('[Analytics]', eventName, data);
  }

  getEvents() {
    return [...this.events];
  }
}
```

## Debugging

```javascript
// In console:

// Access engine
window.traceEngine

// Access plugin manager
window.tracePlugins

// Get specific plugin
window.tracePlugins.get('ThemePlugin')

// List all plugins
window.tracePlugins.list()

// Check if plugin exists
window.tracePlugins.has('ThemePlugin')
```

## Testing Plugins

```javascript
// test/plugins/theme.test.js
import { TraceEngine } from '../js/core/trace-engine.js';
import { ThemePlugin } from '../js/plugins/theme.plugin.js';

describe('ThemePlugin', () => {
  let engine;
  let plugin;

  beforeEach(() => {
    engine = new TraceEngine({ themeColors: ['#FFF', '#000'] });
    plugin = new ThemePlugin();
    engine.plugins.register('ThemePlugin', plugin);
  });

  afterEach(() => {
    engine.destroy();
  });

  it('should cycle themes', () => {
    expect(engine.colorIndex).toBe(0);
    plugin.cycleTheme();
    expect(engine.colorIndex).toBe(1);
  });
});
```

## Contributing Plugins

1. Follow naming convention: `*.plugin.js`
2. Extend `TracePlugin` base class
3. Document public API in JSDoc
4. Add tests for critical functionality
5. Update this README with plugin description

## Future Enhancements

- [ ] Plugin marketplace/registry
- [ ] Dynamic plugin loading (import on demand)
- [ ] Plugin configuration UI
- [ ] Plugin sandboxing/security
- [ ] Plugin performance monitoring
- [ ] Cross-plugin communication bus
