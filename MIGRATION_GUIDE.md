# TRACE Migration Guide: Monolith → Plugin Architecture

## Overview

TRACE has been refactored from a monolithic architecture to a modular plugin system. This guide explains the changes and how to migrate any customizations.

## What Changed

### Before (Monolithic)
```
js/
├── trace-engine.js  (1306 lines, everything in one file)
├── theme.js         (theme data)
└── app.js           (bootstrap)
```

### After (Plugin Architecture)
```
js/
├── core/
│   ├── trace-engine.js      (300 lines, core only)
│   ├── plugin-manager.js    (hot-reload support)
│   ├── constants.js         (shared constants)
│   └── utils.js             (utilities)
├── plugins/
│   ├── theme.plugin.js      (theme management)
│   ├── locale.plugin.js     (i18n)
│   ├── tooltip.plugin.js    (tooltips)
│   ├── interaction.plugin.js (gestures)
│   ├── progress.plugin.js   (time updates)
│   ├── devtools.plugin.js   (dev utilities)
│   └── a11y.plugin.js       (accessibility)
├── config/
│   └── theme-colors.js      (theme data)
└── app.js                   (plugin loader)
```

## Breaking Changes

### Import Paths

**Before:**
```javascript
import { TraceEngine } from './trace-engine.js';
import { THEME_COLORS, COLOR_OF_YEAR } from './theme.js';
```

**After:**
```javascript
import { TraceEngine } from './core/trace-engine.js';
import { THEME_COLORS, COLOR_OF_YEAR } from './config/theme-colors.js';
```

### Engine API

The core `TraceEngine` class now has a minimal API. Feature-specific methods moved to plugins.

**Before:**
```javascript
engine.cycleTheme();
engine.randomizeNowUTC();
engine.setLocale('id');
```

**After:**
```javascript
// Access via plugins
const themePlugin = engine.plugins.get('ThemePlugin');
themePlugin.cycleTheme();

const devTools = engine.plugins.get('DevToolsPlugin');
devTools.randomizeNowUTC();

const localePlugin = engine.plugins.get('LocalePlugin');
localePlugin.setLocale('id');
```

## Migration Steps

### 1. Update Import Paths

If you have custom code importing TRACE modules:

```javascript
// Old imports
import { TraceEngine } from './js/trace-engine.js';
import { THEME_COLORS } from './js/theme.js';

// New imports
import { TraceEngine } from './js/core/trace-engine.js';
import { THEME_COLORS } from './js/config/theme-colors.js';
```

### 2. Access Features via Plugins

Replace direct engine method calls with plugin access:

```javascript
// Old way
engine.cycleTheme();

// New way
const themePlugin = engine.plugins.get('ThemePlugin');
if (themePlugin) {
  themePlugin.cycleTheme();
}
```

### 3. Custom Plugins

If you had custom modifications, convert them to plugins:

**Before (modifying trace-engine.js):**
```javascript
class TraceEngine {
  // ... original code
  
  // Your custom method
  myCustomFeature() {
    console.log('Custom!');
  }
}
```

**After (create custom plugin):**
```javascript
// plugins/custom.plugin.js
import { TracePlugin } from '../core/plugin-manager.js';

export class CustomPlugin extends TracePlugin {
  constructor() {
    super('CustomPlugin');
  }

  init(engine) {
    super.init(engine);
    this.myCustomFeature();
  }

  myCustomFeature() {
    console.log('Custom!');
  }
}

// app.js
import { CustomPlugin } from './plugins/custom.plugin.js';
engine.plugins.register('CustomPlugin', new CustomPlugin());
```

## Backwards Compatibility

### Option 1: Wrapper (Temporary)

Create a wrapper to maintain old API:

```javascript
// js/trace-engine-compat.js
import { TraceEngine as CoreEngine } from './core/trace-engine.js';

export class TraceEngine extends CoreEngine {
  cycleTheme() {
    return this.plugins.get('ThemePlugin')?.cycleTheme();
  }

  setLocale(locale, options) {
    return this.plugins.get('LocalePlugin')?.setLocale(locale, options);
  }

  randomizeNowUTC() {
    return this.plugins.get('DevToolsPlugin')?.randomizeNowUTC();
  }
  
  // Add other legacy methods as needed
}
```

### Option 2: Direct Migration (Recommended)

Update all references to use the new plugin API directly.

## Feature Mapping

| Old Method | New Location |
|------------|-------------|
| `engine.cycleTheme()` | `ThemePlugin.cycleTheme()` |
| `engine.setThemeIndex()` | `ThemePlugin.setThemeIndex()` |
| `engine.updateDynamicColors()` | `ThemePlugin.updateDynamicColors()` |
| `engine.setLocale()` | `LocalePlugin.setLocale()` |
| `engine.formatDayInfo()` | `LocalePlugin.formatDayInfo()` |
| `engine.showTooltipAt()` | `TooltipPlugin.showTooltipAt()` |
| `engine.triggerHaptic()` | `InteractionPlugin.triggerHaptic()` |
| `engine.randomizeNowUTC()` | `DevToolsPlugin.randomizeNowUTC()` |
| `engine.resetToDefaults()` | `DevToolsPlugin.resetToDefaults()` |

## Benefits

### 1. Modularity
- Enable/disable features independently
- Load only what you need

### 2. Maintainability
- Smaller, focused files
- Clear separation of concerns
- Easier to understand and modify

### 3. Testability
- Test plugins in isolation
- Mock dependencies easily
- Faster test execution

### 4. Extensibility
- Create custom plugins
- Override default behavior
- Hot-reload during development

### 5. Performance
- Lazy-load plugins on demand (future)
- Tree-shake unused code
- Smaller bundle size

## Examples

### Example 1: Custom Theme Plugin

```javascript
// plugins/seasonal-theme.plugin.js
import { TracePlugin } from '../core/plugin-manager.js';

export class SeasonalThemePlugin extends TracePlugin {
  constructor() {
    super('SeasonalThemePlugin');
  }

  init(engine) {
    super.init(engine);
    this.applySeasonalTheme();
  }

  applySeasonalTheme() {
    const month = this.engine.getNow().getMonth();
    const themePlugin = this.engine.plugins.get('ThemePlugin');
    
    if (!themePlugin) return;
    
    // Spring: greens
    if (month >= 2 && month <= 4) {
      themePlugin.setThemeIndex(4);
    }
    // Summer: warm colors
    else if (month >= 5 && month <= 7) {
      themePlugin.setThemeIndex(7);
    }
    // Fall: earth tones
    else if (month >= 8 && month <= 10) {
      themePlugin.setThemeIndex(6);
    }
    // Winter: cool colors
    else {
      themePlugin.setThemeIndex(2);
    }
  }
}
```

### Example 2: Analytics Plugin

```javascript
// plugins/analytics.plugin.js
import { TracePlugin } from '../core/plugin-manager.js';

export class AnalyticsPlugin extends TracePlugin {
  constructor() {
    super('AnalyticsPlugin');
    this.sessionStart = Date.now();
  }

  init(engine) {
    super.init(engine);
    
    // Track renders
    this.renderCount = 0;
  }

  onRender() {
    this.renderCount++;
    console.log('Total renders:', this.renderCount);
  }

  getSessionDuration() {
    return Date.now() - this.sessionStart;
  }
}
```

### Example 3: Disable Specific Features

```javascript
// app.js - Minimal setup without devtools
import { TraceEngine } from './core/trace-engine.js';
import { ThemePlugin } from './plugins/theme.plugin.js';
import { LocalePlugin } from './plugins/locale.plugin.js';

const engine = new TraceEngine({/* config */});

// Register only essential plugins
engine.plugins.register('LocalePlugin', new LocalePlugin());
engine.plugins.register('ThemePlugin', new ThemePlugin());

// Skip DevToolsPlugin, InteractionPlugin, etc.

engine.init();
engine.render();
```

## Troubleshooting

### Issue: "Cannot read property 'cycleTheme' of undefined"

**Cause:** Plugin not registered or accessed before initialization.

**Solution:**
```javascript
// Ensure plugin is registered
const themePlugin = engine.plugins.get('ThemePlugin');
if (!themePlugin) {
  console.error('ThemePlugin not registered');
  return;
}
themePlugin.cycleTheme();
```

### Issue: "Module not found"

**Cause:** Incorrect import path.

**Solution:** Update imports to new paths:
```javascript
// ❌ Old
import { TraceEngine } from './js/trace-engine.js';

// ✅ New
import { TraceEngine } from './js/core/trace-engine.js';
```

### Issue: Features not working

**Cause:** Plugins not initialized or wrong order.

**Solution:** Check plugin registration order in `app.js`:
```javascript
// Correct order
engine.plugins.register('LocalePlugin', new LocalePlugin());  // 1st
engine.plugins.register('ThemePlugin', new ThemePlugin());    // 2nd
engine.plugins.register('InteractionPlugin', new InteractionPlugin()); // After deps
```

## Need Help?

- Check `PLUGIN_SYSTEM.md` for detailed plugin API documentation
- Review `js/plugins/*.plugin.js` for examples
- Open an issue on GitHub with migration questions

## Rollback

If you need to rollback to the old monolithic version:

```bash
# Restore old files
cd js/
mv trace-engine.js.old trace-engine.js
mv theme.js.old theme.js

# Update app.js to use old imports
# (restore from git history)
```

The old files are preserved as `*.old` for safety.
