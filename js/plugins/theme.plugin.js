// TRACE Theme Plugin
// Manages theme colors, palettes, and dynamic color updates

import { TracePlugin } from '../core/plugin-manager.js';
import { TONE_TO_DARK_LUM, TONE_TO_LIGHT_LUM } from '../core/constants.js';
import { normalizeHex, relativeLuminanceFromHex, hexToRgb01, rgbToHsl, hslToRgb, rgbToHex } from '../core/utils.js';

export class ThemePlugin extends TracePlugin {
  constructor() {
    super('ThemePlugin');
    this._themeVarCache = new Map();
  }

  init(engine) {
    super.init(engine);

    // Initialize theme cache
    for (const hex of engine.themeColors) {
      const key = normalizeHex(hex);
      this._themeVarCache.set(key, this.computeThemeVars(key));
    }

    // Load saved theme index or default
    engine.colorIndex = this.resolveDefaultThemeIndex();

    // Apply initial theme
    this.updateDynamicColors(engine.themeColors[engine.colorIndex]);
  }

  /**
   * Compute theme-dependent CSS variables
   */
  computeThemeVars(hex) {
    const lum = relativeLuminanceFromHex(hex);
    const bar = `oklch(from ${hex} ${lum < 0.35 ? 0.9 : 0.3} ${lum < 0.35 ? 0.05 : 0.1} h / 0.7)`;
    const hoverL = lum > 0.75 ? 0.6 : Math.max(0.2, Math.min(0.8, lum));
    const hoverC = lum > 0.75 ? 0.15 : 0.1;
    const hover = `oklch(from ${hex} ${hoverL} ${hoverC} h)`;
    const ghostLabelToday = `oklch(from ${hex} ${lum < 0.35 ? 0.92 : 0.22} ${lum < 0.35 ? 0.05 : 0.04} h)`;
    const tone = lum < TONE_TO_DARK_LUM ? 'dark' : 'light';
    const watermarkBoostOpacity = lum > 0.72 ? 0.2 : lum < 0.3 ? 0.26 : 0.24;
    const todayRingMixPct = lum > 0.72 ? 45 : lum < 0.3 ? 60 : 55;
    const todayShadowAlpha = lum > 0.72 ? 0.22 : lum < 0.3 ? 0.3 : 0.28;
    return { bar, hover, ghostLabelToday, tone, watermarkBoostOpacity, todayRingMixPct, todayShadowAlpha };
  }

  /**
   * Update CSS custom properties based on theme color
   */
  updateDynamicColors(hex) {
    const normalized = normalizeHex(hex);
    document.documentElement.style.setProperty('--tr-base-hex', normalized);
    
    const cached =
      this._themeVarCache.get(normalized) ??
      (() => {
        const computed = this.computeThemeVars(normalized);
        this._themeVarCache.set(normalized, computed);
        return computed;
      })();
    
    document.documentElement.style.setProperty('--tr-color-bar-adaptive', cached.bar);
    document.documentElement.style.setProperty('--tr-color-hover-adaptive', cached.hover);
    document.documentElement.style.setProperty('--tr-color-ghost-label-today', cached.ghostLabelToday);
    
    if (typeof cached.watermarkBoostOpacity === 'number') {
      document.documentElement.style.setProperty(
        '--tr-watermark-boost-opacity',
        String(Math.max(0, Math.min(1, cached.watermarkBoostOpacity)))
      );
    }
    
    if (typeof cached.todayRingMixPct === 'number') {
      const pct = Math.max(0, Math.min(100, cached.todayRingMixPct));
      document.documentElement.style.setProperty('--tr-today-ring-mix', `${pct}%`);
    }
    
    if (typeof cached.todayShadowAlpha === 'number') {
      document.documentElement.style.setProperty(
        '--tr-today-shadow-alpha',
        String(Math.max(0, Math.min(1, cached.todayShadowAlpha)))
      );
    }
    
    const prevTone = document.documentElement.dataset.trTone;
    let nextTone = cached.tone;
    const lum = relativeLuminanceFromHex(normalized);
    
    if (prevTone === 'dark') {
      nextTone = lum > TONE_TO_LIGHT_LUM ? 'light' : 'dark';
    } else if (prevTone === 'light') {
      nextTone = lum < TONE_TO_DARK_LUM ? 'dark' : 'light';
    }
    
    if (nextTone) document.documentElement.dataset.trTone = nextTone;
  }

  /**
   * Set theme by index
   */
  setThemeIndex(index, { persist = true } = {}) {
    const safeIndex = ((index % this.engine.themeColors.length) + this.engine.themeColors.length) % this.engine.themeColors.length;
    this.engine.colorIndex = safeIndex;
    this.updateDynamicColors(this.engine.themeColors[this.engine.colorIndex]);
    
    if (persist) {
      try {
        localStorage.setItem('tr_theme_index', this.engine.colorIndex);
      } catch {}
    }
    
    if (this.engine.announcer) {
      const localePlugin = this.engine.plugins.get('LocalePlugin');
      const t = localePlugin?._t || {};
      this.engine.announcer.innerText = t.themeChanged ? t.themeChanged(this.engine.colorIndex + 1) : `Theme ${this.engine.colorIndex + 1}`;
    }
    
    this.engine.viewport.classList.remove('tr-theme-pulse');
    void this.engine.viewport.offsetWidth;
    this.engine.viewport.classList.add('tr-theme-pulse');
  }

  /**
   * Cycle to next theme
   */
  cycleTheme() {
    this.setThemeIndex(this.engine.colorIndex + 1, { persist: true });
  }

  /**
   * Get color for a specific year
   */
  getColorForYear(year) {
    const map = this.engine.colorOfYearMap;
    const keys = Object.keys(map)
      .map((y) => parseInt(y, 10))
      .sort((a, b) => a - b);
    const derivedMin = keys[0];
    const derivedMax = keys[keys.length - 1];
    const minSupported = Number.isFinite(this.engine._supportedYearMin) ? this.engine._supportedYearMin : derivedMin;
    const maxSupported = Number.isFinite(this.engine._supportedYearMax) ? this.engine._supportedYearMax : derivedMax;
    const y = Number.parseInt(year, 10);
    
    if (Number.isNaN(y)) return map[derivedMax];
    if (y <= minSupported) return map[derivedMin] || map[minSupported] || map[derivedMax];
    
    if (y >= maxSupported) {
      const base = map[derivedMax];
      const rgb = hexToRgb01(base);
      if (!rgb) return base;
      const r = Math.round(rgb.r * 255);
      const g = Math.round(rgb.g * 255);
      const b = Math.round(rgb.b * 255);
      const { h, s, l } = rgbToHsl(r, g, b);
      const shift = ((y - derivedMax) * 6) % 360;
      const newRgb = hslToRgb((h + shift) % 360, s, l);
      return rgbToHex(newRgb.r, newRgb.g, newRgb.b);
    }
    
    let nearest = derivedMin;
    let bestDist = Infinity;
    for (const ky of keys) {
      const d = Math.abs(ky - y);
      if (d < bestDist) {
        bestDist = d;
        nearest = ky;
      }
    }
    return map[nearest] || map[derivedMin];
  }

  /**
   * Set theme by year
   */
  setThemeByYear(year, { persist = false } = {}) {
    try {
      const hex = this.getColorForYear(Number(year));
      if (!hex) return;
      this.updateDynamicColors(hex);
      
      if (persist) {
        try {
          localStorage.setItem('tr_theme_year', String(year));
        } catch {}
      }
      
      if (this.engine.announcer) {
        this.engine.announcer.innerText = `Theme color set for ${year}`;
      }
    } catch (e) {
      console.warn('setThemeByYear failed', e);
    }
  }

  /**
   * Randomize theme
   */
  randomizeTheme({ persist = false } = {}) {
    const baseYear = this.engine.getNow().getUTCFullYear();
    const keys = Object.keys(this.engine.colorOfYearMap)
      .map((y) => parseInt(y, 10))
      .sort((a, b) => a - b);
    const derivedMin = keys[0];
    const derivedMax = keys[keys.length - 1];
    const minSupported = Number.isFinite(this.engine._supportedYearMin) ? this.engine._supportedYearMin : derivedMin;
    const maxSupported = Number.isFinite(this.engine._supportedYearMax) ? this.engine._supportedYearMax : derivedMax;
    const minY = Math.min(minSupported, baseYear - 10);
    const maxY = Math.max(maxSupported, baseYear + 10);
    const randYear = Math.floor(Math.random() * (maxY - minY + 1)) + minY;
    this.setThemeByYear(randYear, { persist });
  }

  /**
   * Resolve default theme index from localStorage or system preference
   */
  resolveDefaultThemeIndex() {
    try {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      const savedIndex = localStorage.getItem('tr_theme_index');
      const index = savedIndex ? parseInt(savedIndex, 10) : prefersDark ? 1 : 0;
      if (Number.isNaN(index) || index < 0 || index >= this.engine.themeColors.length) return 0;
      return index;
    } catch {
      return 0;
    }
  }
}
