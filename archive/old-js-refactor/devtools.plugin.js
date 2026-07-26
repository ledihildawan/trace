// TRACE DevTools Plugin
// Development and testing utilities

import { TracePlugin } from '../core/plugin-manager.js';
import { daysInMonthUTC } from '../core/utils.js';

export class DevToolsPlugin extends TracePlugin {
  constructor() {
    super('DevToolsPlugin');
  }

  init(engine) {
    super.init(engine);
  }

  /**
   * Set supported year range
   */
  setSupportedYearRange(min, max) {
    const mi = Number.parseInt(min, 10);
    const ma = Number.parseInt(max, 10);
    if (!Number.isFinite(mi) || !Number.isFinite(ma) || mi > ma) return false;
    this.engine._supportedYearMin = mi;
    this.engine._supportedYearMax = ma;
    return true;
  }

  /**
   * Set simulated time (UTC)
   */
  setSimulatedNowUTC(dateUTC) {
    this.engine._simulatedNow = dateUTC;
    this.engine.applyNow(dateUTC);
    this.engine.render();
  }

  /**
   * Reset to real time
   */
  resetNowToReal() {
    this.engine._simulatedNow = null;
    this.engine.applyNow(this.engine.getNow());
    this.engine.render();

    const localePlugin = this.engine.plugins.get('LocalePlugin');
    const t = localePlugin?._t || {};
    if (this.engine.announcer) {
      this.engine.announcer.innerText = t.backToRealTime || 'Back to real time';
    }
  }

  /**
   * Randomize time (UTC)
   */
  randomizeNowUTC() {
    const baseYear = this.engine.getNow().getUTCFullYear();
    const keys = Object.keys(this.engine.colorOfYearMap)
      .map((y) => parseInt(y, 10))
      .sort((a, b) => a - b);
    const derivedMin = keys[0];
    const derivedMax = keys[keys.length - 1];
    const minSupported = Number.isFinite(this.engine._supportedYearMin) ? this.engine._supportedYearMin : derivedMin;
    const maxSupported = Number.isFinite(this.engine._supportedYearMax) ? this.engine._supportedYearMax : derivedMax;
    const minYear = Math.min(minSupported, baseYear - 10);
    const maxYear = Math.max(maxSupported, baseYear + 10);
    const year = Math.floor(Math.random() * (maxYear - minYear + 1)) + minYear;
    const month = Math.floor(Math.random() * 12);
    const dayMax = daysInMonthUTC(year, month);
    const day = 1 + Math.floor(Math.random() * dayMax);
    const hour = Math.floor(Math.random() * 24);
    const minute = Math.floor(Math.random() * 60);
    const simulated = new Date(Date.UTC(year, month, day, hour, minute, 0));
    this.setSimulatedNowUTC(simulated);

    const themePlugin = this.engine.plugins.get('ThemePlugin');
    if (themePlugin) {
      try {
        const hex = themePlugin.getColorForYear(simulated.getUTCFullYear());
        if (hex) {
          this.engine.colorIndex = 0;
          themePlugin.updateDynamicColors(hex);
        }
      } catch {}
    }

    const localePlugin = this.engine.plugins.get('LocalePlugin');
    if (localePlugin) {
      const dateLong = localePlugin._dtfLongUTC.format(simulated);
      const t = localePlugin._t || {};
      if (this.engine.announcer) {
        this.engine.announcer.innerText = t.testTimeRandomized
          ? t.testTimeRandomized(dateLong)
          : `Test time: ${dateLong}`;
      }
    }
  }

  /**
   * Reset to default settings
   */
  resetToDefaults() {
    this.engine._simulatedNow = null;

    const localePlugin = this.engine.plugins.get('LocalePlugin');
    if (localePlugin) {
      localePlugin._localeOverride = null;
      const currentLocale = navigator.language ?? 'en';
      localePlugin.setLocale(currentLocale, { announce: false, render: false, override: false });
    }

    const themePlugin = this.engine.plugins.get('ThemePlugin');
    if (themePlugin) {
      const defaultThemeIndex = themePlugin.resolveDefaultThemeIndex();
      themePlugin.setThemeIndex(defaultThemeIndex, { persist: false });
    }

    this.engine.applyNow(new Date());
    this.engine.render();

    const t = localePlugin?._t || {};
    if (this.engine.announcer) {
      this.engine.announcer.innerText = t.resetDefaults || 'Reset to defaults';
    }
  }

  /**
   * Randomize theme, time, and locale
   */
  randomizeThemeNowAndLocale() {
    const localePlugin = this.engine.plugins.get('LocalePlugin');
    if (localePlugin) {
      localePlugin.randomizeLocale({ announce: false, render: false });
    }

    const themePlugin = this.engine.plugins.get('ThemePlugin');
    if (themePlugin) {
      themePlugin.randomizeTheme({ persist: false });
    }

    this.randomizeNowUTC();
  }
}
