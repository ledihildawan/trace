// TRACE Engine: framework-agnostic core
// Exported as an ES module for use across frameworks

export class TraceEngine {
  static MS_PER_DAY = 86_400_000;
  static MINUTES_PER_DAY = 1_440;

  static TONE_TO_DARK_LUM = 0.38;
  static TONE_TO_LIGHT_LUM = 0.44;

  static LONG_PRESS_DURATION = 500;
  static TOOLTIP_LINGER_MS = 2500;
  static TIME_UPDATE_INTERVAL = 60000;
  static RESIZE_DEBOUNCE_MS = 100;

  static OPACITY_DECAY_RATE = 0.008;
  static GRAYSCALE_RATE = 0.5;
  static HAPTIC_SCRUB_MS = 5;
  static HAPTIC_SUCCESS_MS = 50;
  static DRAG_THRESHOLD_PX = 15;

  // Instance-scoped supported year range (optional)
  _supportedYearMin = null;
  _supportedYearMax = null;

  _rafPending = false;
  _pendingX = 0;
  _pendingY = 0;
  _lastHoveredElement = null;
  _pressedElement = null;
  _lastHapticAt = { scrub: 0, success: 0 };

  /**
   * @param {Object} options
   * @param {string[]} options.themeColors - Palette to cycle through
   * @param {Record<number,string>} options.colorOfYearMap - Year→hex mapping
   * @param {HTMLElement} [options.viewport]
   * @param {HTMLElement} [options.watermark]
   * @param {HTMLElement} [options.tooltip]
   * @param {HTMLElement} [options.announcer]
   * @param {HTMLElement} [options.srStatus]
   */
  constructor({
    themeColors = ['#F6F2EA'],
    colorOfYearMap = {},
    viewport = document.getElementById('tr-viewport'),
    watermark = document.getElementById('tr-year-watermark'),
    tooltip = document.getElementById('tr-tooltip'),
    announcer = document.getElementById('tr-a11y-announcer'),
    srStatus = document.getElementById('tr-sr-status'),
  } = {}) {
    this.themeColors = themeColors;
    this.colorOfYearMap = colorOfYearMap;

    this.viewport = viewport;
    this.watermark = watermark;
    this.tooltip = tooltip;
    this.announcer = announcer;
    this.srStatus = srStatus;

    this._ac = new AbortController();
    this._signal = this._ac.signal;

    const langPrimaryRaw = (navigator.language ?? 'en').toLowerCase().split('-')[0];
    const langAlias = { jp: 'ja', gr: 'de' };
    const langPrimary = langAlias[langPrimaryRaw] ?? langPrimaryRaw;

    this._i18n = {
      en: {
        backToRealTime: 'Back to real time',
        resetDefaults: 'Reset to defaults',
        themeChanged: (n) => `Theme changed to color scheme ${n}`,
        localeChanged: (loc) => `Language changed: ${loc}`,
        testTimeRandomized: (dateLong) => `Test time randomized: ${dateLong}`,
        formatDayInfo: (dayStr, pctStr) => `Day ${dayStr} • ${pctStr} of this year`,
      },
      id: {
        backToRealTime: 'Kembali ke waktu nyata',
        resetDefaults: 'Dikembalikan ke pengaturan awal',
        themeChanged: (n) => `Tema diganti ke skema warna ${n}`,
        localeChanged: (loc) => `Bahasa diubah: ${loc}`,
        testTimeRandomized: (dateLong) => `Waktu uji diacak: ${dateLong}`,
        formatDayInfo: (dayStr, pctStr) => `Hari ${dayStr} • ${pctStr} dari tahun ini`,
      },
      // ... keep other locales identical to original
      es: {
        backToRealTime: 'Volver al tiempo real',
        resetDefaults: 'Restablecido a los valores predeterminados',
        themeChanged: (n) => `Tema cambiado al esquema de color ${n}`,
        localeChanged: (loc) => `Idioma cambiado: ${loc}`,
        testTimeRandomized: (dateLong) => `Hora de prueba aleatorizada: ${dateLong}`,
        formatDayInfo: (dayStr, pctStr) => `Día ${dayStr} • ${pctStr} de este año`,
      },
      ja: {
        backToRealTime: '実時間に戻しました',
        resetDefaults: '既定にリセットしました',
        themeChanged: (n) => `テーマを配色 ${n} に変更しました`,
        localeChanged: (loc) => `言語を変更しました: ${loc}`,
        testTimeRandomized: (dateLong) => `テスト時刻をランダム化: ${dateLong}`,
        formatDayInfo: (dayStr, pctStr) => `今年 ${dayStr}日目 • ${pctStr}`,
      },
      de: {
        backToRealTime: 'Zurück zur Echtzeit',
        resetDefaults: 'Auf Standard zurückgesetzt',
        themeChanged: (n) => `Theme auf Farbschema ${n} geändert`,
        localeChanged: (loc) => `Sprache geändert: ${loc}`,
        testTimeRandomized: (dateLong) => `Testzeit zufällig gesetzt: ${dateLong}`,
        formatDayInfo: (dayStr, pctStr) => `Tag ${dayStr} • ${pctStr} dieses Jahres`,
      },
      el: {
        backToRealTime: 'Επιστροφή σε πραγματικό χρόνο',
        resetDefaults: 'Επαναφορά στις προεπιλογές',
        themeChanged: (n) => `Το θέμα άλλαξε σε χρωματικό σχήμα ${n}`,
        localeChanged: (loc) => `Η γλώσσα άλλαξε: ${loc}`,
        testTimeRandomized: (dateLong) => `Τυχαία δοκιμαστική ώρα: ${dateLong}`,
        formatDayInfo: (dayStr, pctStr) => `Ημέρα ${dayStr} • ${pctStr} του φετινού έτους`,
      },
      fr: {
        backToRealTime: 'Retour au temps réel',
        resetDefaults: 'Réinitialisé par défaut',
        themeChanged: (n) => `Thème changé vers le schéma de couleur ${n}`,
        localeChanged: (loc) => `Langue changée : ${loc}`,
        testTimeRandomized: (dateLong) => `Heure de test aléatoire : ${dateLong}`,
        formatDayInfo: (dayStr, pctStr) => `Jour ${dayStr} • ${pctStr} de cette année`,
      },
      pt: {
        backToRealTime: 'Voltar ao tempo real',
        resetDefaults: 'Redefinido para o padrão',
        themeChanged: (n) => `Tema alterado para o esquema de cores ${n}`,
        localeChanged: (loc) => `Idioma alterado: ${loc}`,
        testTimeRandomized: (dateLong) => `Hora de teste aleatória: ${dateLong}`,
        formatDayInfo: (dayStr, pctStr) => `Dia ${dayStr} • ${pctStr} deste ano`,
      },
      zh: {
        backToRealTime: '返回实时',
        resetDefaults: '已重置为默认',
        themeChanged: (n) => `主题已切换到配色 ${n}`,
        localeChanged: (loc) => `语言已切换：${loc}`,
        testTimeRandomized: (dateLong) => `测试时间已随机：${dateLong}`,
        formatDayInfo: (dayStr, pctStr) => `今年第${dayStr}天 • ${pctStr}`,
      },
      ko: {
        backToRealTime: '실시간으로 돌아갔습니다',
        resetDefaults: '기본값으로 재설정됨',
        themeChanged: (n) => `테마를 색상 구성 ${n}(으)로 변경했습니다`,
        localeChanged: (loc) => `언어가 변경되었습니다: ${loc}`,
        testTimeRandomized: (dateLong) => `테스트 시간이 무작위로 설정됨: ${dateLong}`,
        formatDayInfo: (dayStr, pctStr) => `올해 ${dayStr}일째 • ${pctStr}`,
      },
      ru: {
        backToRealTime: 'Возврат к реальному времени',
        resetDefaults: 'Сброшено к значениям по умолчанию',
        themeChanged: (n) => `Тема изменена на цветовую схему ${n}`,
        localeChanged: (loc) => `Язык изменён: ${loc}`,
        testTimeRandomized: (dateLong) => `Тестовое время случайно: ${dateLong}`,
        formatDayInfo: (dayStr, pctStr) => `День ${dayStr} • ${pctStr} этого года`,
      },
      ar: {
        backToRealTime: 'العودة إلى الوقت الحقيقي',
        resetDefaults: 'تمت إعادة الضبط إلى الإعدادات الافتراضية',
        themeChanged: (n) => `تم تغيير النسق إلى مخطط الألوان ${n}`,
        localeChanged: (loc) => `تم تغيير اللغة: ${loc}`,
        testTimeRandomized: (dateLong) => `تم عشوائية وقت الاختبار: ${dateLong}`,
        formatDayInfo: (dayStr, pctStr) => `اليوم ${dayStr} • ${pctStr} من هذا العام`,
      },
      hi: {
        backToRealTime: 'वास्तविक समय पर वापस',
        resetDefaults: 'डिफ़ॉल्ट पर रीसेट किया गया',
        themeChanged: (n) => `थीम रंग योजना ${n} पर बदली गई`,
        localeChanged: (loc) => `भाषा बदली गई: ${loc}`,
        testTimeRandomized: (dateLong) => `परीक्षण समय यादृच्छिक: ${dateLong}`,
        formatDayInfo: (dayStr, pctStr) => `दिन ${dayStr} • ${pctStr} इस वर्ष का`,
      },
    };
    this._lang = this._i18n[langPrimary] ? langPrimary : 'en';
    this._t = this._i18n[this._lang] ?? this._i18n.en;

    this._testLocales = [
      'en',
      'id',
      'es',
      'ja',
      'de',
      'fr',
      'pt-BR',
      'pt-PT',
      'zh-Hans',
      'zh-Hant',
      'ko',
      'ru',
      'ar',
      'hi',
    ];
    this._localeOverride = null;

    // Prefer user's system language
    this.setLocale(navigator.language ?? 'en', { announce: false, render: false });

    this._themeVarCache = new Map();
    for (const hex of this.themeColors) {
      const key = TraceEngine.#normalizeHex(hex);
      this._themeVarCache.set(key, TraceEngine.#computeThemeVars(key));
    }

    this._simulatedNow = null;
    this.applyNow(this.getNow());

    this.tooltipHideTimer = null;
    this.pressTimer = null;
    this.isLongPressMode = false;
    this.ignoreHover = false;
    this.resizeTimer = null;
    this.timeUpdateInterval = null;
    this.startX = 0;
    this.startY = 0;

    this._hoverMql = window.matchMedia('(hover: hover)');
    this.hasHover = this._hoverMql.matches;
    this.tooltipWidth = 0;
    this.tooltipHeight = 0;
    this.currentFocusIndex = -1;

    try {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      const savedIndex = localStorage.getItem('tr_theme_index');
      this.colorIndex = savedIndex ? parseInt(savedIndex, 10) : prefersDark ? 1 : 0;
      if (isNaN(this.colorIndex) || this.colorIndex < 0 || this.colorIndex >= this.themeColors.length) {
        this.colorIndex = 0;
      }
    } catch {
      this.colorIndex = 0;
    }

    this.init();
  }

  static #hexToRgb01(hex) {
    const cleaned = hex.trim().replace(/^#/, '');
    const normalized = cleaned.length === 3 ? cleaned.replace(/(.)/g, '$1$1') : cleaned;
    if (normalized.length !== 6) return null;
    const value = Number.parseInt(normalized, 16);
    if (Number.isNaN(value)) return null;
    const r = (value >> 16) & 0xff;
    const g = (value >> 8) & 0xff;
    const b = value & 0xff;
    return { r: r / 255, g: g / 255, b: b / 255 };
  }
  static #srgbToLinear(c) {
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }
  static #relativeLuminanceFromHex(hex) {
    const rgb = TraceEngine.#hexToRgb01(hex);
    if (!rgb) return 0.5;
    const r = TraceEngine.#srgbToLinear(rgb.r);
    const g = TraceEngine.#srgbToLinear(rgb.g);
    const b = TraceEngine.#srgbToLinear(rgb.b);
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }
  static #normalizeHex(hex) {
    return hex.trim().toUpperCase();
  }
  static #computeThemeVars(hex) {
    const lum = TraceEngine.#relativeLuminanceFromHex(hex);
    const bar = `oklch(from ${hex} ${lum < 0.35 ? 0.9 : 0.3} ${lum < 0.35 ? 0.05 : 0.1} h / 0.7)`;
    const hoverL = lum > 0.75 ? 0.6 : Math.max(0.2, Math.min(0.8, lum));
    const hoverC = lum > 0.75 ? 0.15 : 0.1;
    const hover = `oklch(from ${hex} ${hoverL} ${hoverC} h)`;
    const ghostLabelToday = `oklch(from ${hex} ${lum < 0.35 ? 0.92 : 0.22} ${lum < 0.35 ? 0.05 : 0.04} h)`;
    const tone = lum < TraceEngine.TONE_TO_DARK_LUM ? 'dark' : 'light';
    const watermarkBoostOpacity = lum > 0.72 ? 0.2 : lum < 0.3 ? 0.26 : 0.24;
    const todayRingMixPct = lum > 0.72 ? 45 : lum < 0.3 ? 60 : 55;
    const todayShadowAlpha = lum > 0.72 ? 0.22 : lum < 0.3 ? 0.3 : 0.28;
    return { bar, hover, ghostLabelToday, tone, watermarkBoostOpacity, todayRingMixPct, todayShadowAlpha };
  }

  getNow() {
    return this._simulatedNow ?? new Date();
  }

  setSupportedYearRange(min, max) {
    const mi = Number.parseInt(min, 10);
    const ma = Number.parseInt(max, 10);
    if (!Number.isFinite(mi) || !Number.isFinite(ma) || mi > ma) return false;
    this._supportedYearMin = mi;
    this._supportedYearMax = ma;
    return true;
  }

  setLocale(locale, { announce = false, render = true, override = false } = {}) {
    const activeLocale = locale || 'en';
    if (override) this._localeOverride = activeLocale;
    this._activeLocale = activeLocale;
    document.documentElement.lang = activeLocale;
    const primaryRaw = activeLocale.toLowerCase().split('-')[0];
    const rtlLangs = new Set(['ar', 'fa', 'he', 'iw', 'ur', 'ps']);
    if (rtlLangs.has(primaryRaw)) document.documentElement.dir = 'rtl';
    else document.documentElement.removeAttribute('dir');

    const dtfLocale = activeLocale;
    try {
      this._dtfLongUTC = new Intl.DateTimeFormat(dtfLocale, {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        timeZone: 'UTC',
      });
      this._dtfMonthLabelUTC = new Intl.DateTimeFormat(dtfLocale, { month: 'short', timeZone: 'UTC' });
      this._nfInteger = new Intl.NumberFormat(dtfLocale, { maximumFractionDigits: 0 });
      this._nfPercent1 = new Intl.NumberFormat(dtfLocale, { style: 'percent', maximumFractionDigits: 1 });
    } catch {
      this._dtfLongUTC = new Intl.DateTimeFormat(undefined, {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        timeZone: 'UTC',
      });
      this._dtfMonthLabelUTC = new Intl.DateTimeFormat(undefined, { month: 'short', timeZone: 'UTC' });
      this._nfInteger = new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 });
      this._nfPercent1 = new Intl.NumberFormat(undefined, { style: 'percent', maximumFractionDigits: 1 });
    }

    const alias = { jp: 'ja', gr: 'de' };
    const primary = alias[primaryRaw] ?? primaryRaw;
    this._lang = this._i18n[primary] ? primary : 'en';
    this._t = this._i18n[this._lang] ?? this._i18n.en;

    if (announce && this.announcer) {
      this.announcer.innerText = this._t.localeChanged
        ? this._t.localeChanged(activeLocale)
        : `Language changed: ${activeLocale}`;
    }
    if (render) this.render();
  }

  applyNow(now) {
    this.year = now.getUTCFullYear();
    this.todayStr = this.getUTCDateString(now);
    this.todayTime = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
    this.watermark.innerText = this.year;
    this.watermark.dataset.trYear = String(this.year);
  }

  setSimulatedNowUTC(dateUTC) {
    this._simulatedNow = dateUTC;
    this.applyNow(dateUTC);
    this.render();
  }

  #resolveDefaultThemeIndex() {
    try {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      const savedIndex = localStorage.getItem('tr_theme_index');
      const index = savedIndex ? parseInt(savedIndex, 10) : prefersDark ? 1 : 0;
      if (Number.isNaN(index) || index < 0 || index >= this.themeColors.length) return 0;
      return index;
    } catch {
      return 0;
    }
  }

  resetToDefaults() {
    this._simulatedNow = null;
    this._localeOverride = null;
    const currentLocale = navigator.language ?? 'en';
    this.setLocale(currentLocale, { announce: false, render: false, override: false });
    const defaultThemeIndex = this.#resolveDefaultThemeIndex();
    this.setThemeIndex(defaultThemeIndex, { persist: false });
    this.applyNow(new Date());
    this.render();
    this.announcer.innerText = this._t.resetDefaults ?? 'Reset to defaults';
  }

  resetNowToReal() {
    this._simulatedNow = null;
    this.applyNow(this.getNow());
    this.render();
    this.announcer.innerText = this._t.backToRealTime;
  }

  setThemeIndex(index, { persist = true } = {}) {
    const safeIndex = ((index % this.themeColors.length) + this.themeColors.length) % this.themeColors.length;
    this.colorIndex = safeIndex;
    this.updateDynamicColors(this.themeColors[this.colorIndex]);
    if (persist) {
      try {
        localStorage.setItem('tr_theme_index', this.colorIndex);
      } catch {}
    }
    this.announcer.innerText = this._t.themeChanged(this.colorIndex + 1);
    this.viewport.classList.remove('tr-theme-pulse');
    void this.viewport.offsetWidth;
    this.viewport.classList.add('tr-theme-pulse');
  }

  randomizeTheme({ persist = false } = {}) {
    // Prefer year-based color selection within supported range
    const baseYear2 = this.getNow().getUTCFullYear();
    const keys2 = Object.keys(this.colorOfYearMap)
      .map((y) => parseInt(y, 10))
      .sort((a, b) => a - b);
    const derivedMin2 = keys2[0];
    const derivedMax2 = keys2[keys2.length - 1];
    const minSupported2 = Number.isFinite(this._supportedYearMin) ? this._supportedYearMin : derivedMin2;
    const maxSupported2 = Number.isFinite(this._supportedYearMax) ? this._supportedYearMax : derivedMax2;
    const minY = Math.min(minSupported2, baseYear2 - 10);
    const maxY = Math.max(maxSupported2, baseYear2 + 10);
    const randYear = Math.floor(Math.random() * (maxY - minY + 1)) + minY;
    this.setThemeByYear(randYear, { persist });
  }

  static #daysInMonthUTC(year, monthIndex) {
    return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  }

  randomizeNowUTC() {
    const baseYear = this.getNow().getUTCFullYear();
    // pick year in supported range if set, else ±10
    const keys = Object.keys(this.colorOfYearMap)
      .map((y) => parseInt(y, 10))
      .sort((a, b) => a - b);
    const derivedMin = keys[0];
    const derivedMax = keys[keys.length - 1];
    const minSupported = Number.isFinite(this._supportedYearMin) ? this._supportedYearMin : derivedMin;
    const maxSupported = Number.isFinite(this._supportedYearMax) ? this._supportedYearMax : derivedMax;
    const minYear = Math.min(minSupported, baseYear - 10);
    const maxYear = Math.max(maxSupported, baseYear + 10);
    const year = Math.floor(Math.random() * (maxYear - minYear + 1)) + minYear;
    const month = Math.floor(Math.random() * 12);
    const dayMax = TraceEngine.#daysInMonthUTC(year, month);
    const day = 1 + Math.floor(Math.random() * dayMax);
    const hour = Math.floor(Math.random() * 24);
    const minute = Math.floor(Math.random() * 60);
    const simulated = new Date(Date.UTC(year, month, day, hour, minute, 0));
    this.setSimulatedNowUTC(simulated);

    try {
      const hex = this.getColorForYear(simulated.getUTCFullYear());
      if (hex) this.setThemeIndex(0, { persist: false });
      this.updateDynamicColors(hex);
    } catch {}

    const dateLong = this._dtfLongUTC.format(simulated);
    this.announcer.innerText = this._t.testTimeRandomized(dateLong);
  }

  randomizeLocale({ announce = false, render = true } = {}) {
    const current = this._activeLocale ?? 'en';
    const candidates = this._testLocales.filter((l) => l !== current);
    const next = candidates.length ? candidates[Math.floor(Math.random() * candidates.length)] : current;
    this.setLocale(next, { announce, render, override: true });
  }

  randomizeThemeNowAndLocale() {
    this.randomizeLocale({ announce: false, render: false });
    this.randomizeTheme({ persist: false });
    this.randomizeNowUTC();
  }

  formatDayInfo(dayNum, daysInYear) {
    const dayStr = this._nfInteger.format(dayNum);
    const pctStr = this._nfPercent1.format(dayNum / daysInYear);
    if (typeof this._t.formatDayInfo === 'function') return this._t.formatDayInfo(dayStr, pctStr);
    const dayLabel = this._t.dayLabel ?? 'Day';
    const ofYear = this._t.ofThisYear ?? 'of this year';
    return `${dayLabel} ${dayStr} • ${pctStr} ${ofYear}`;
  }

  getUTCDateString(date) {
    return `${date.getUTCDate()} ${date.getUTCMonth()} ${date.getUTCFullYear()}`;
  }

  init() {
    this.updateDynamicColors(this.themeColors[this.colorIndex]);

    window.addEventListener(
      'keydown',
      (e) => {
        // Avoid double-handling when focus is inside the grid (grid has its own key handler)
        if (this.viewport && this.viewport.contains(e.target)) return;
        const key = e.key.toLowerCase();

        // Single key shortcuts (no modifiers)
        if (!e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey) {
          if (key === ' ' || key === 'spacebar') {
            e.preventDefault();
            this.cycleTheme();
            return;
          }
          if (key === 'r') {
            this.randomizeThemeNowAndLocale();
            return;
          }
          if (key === 'x') {
            this.resetToDefaults();
            return;
          }
        }
      },
      { signal: this._signal }
    );

    this._hoverMql.addEventListener(
      'change',
      (e) => {
        this.hasHover = e.matches;
      },
      { signal: this._signal }
    );

    let isDragging = false;
    let activePointerId = null;

    // Triple tap detection for reset
    const tripleTap = { count: 0, timer: null, lastTime: 0 };
    const handleTripleTap = () => {
      const now = performance.now();
      if (now - tripleTap.lastTime > 500) {
        tripleTap.count = 1;
      } else {
        tripleTap.count++;
        if (tripleTap.count === 3) {
          this.resetToDefaults();
          this.triggerHaptic('success');
          tripleTap.count = 0;
        }
      }
      tripleTap.lastTime = now;
      if (tripleTap.timer) clearTimeout(tripleTap.timer);
      tripleTap.timer = setTimeout(() => {
        tripleTap.count = 0;
      }, 500);
    };

    // Edge swipe detection for theme picker
    const edgeSwipe = { isFromEdge: false, startX: 0, startY: 0 };
    const EDGE_THRESHOLD = 30; // pixels from edge
    const SWIPE_MIN_DISTANCE = 60; // minimum swipe distance

    const devTouch = { active: new Map(), timer: null, moved: false, startCenterX: 0, startCenterY: 0 };
    const clearDevTouchTimer = () => {
      if (devTouch.timer) {
        clearTimeout(devTouch.timer);
        devTouch.timer = null;
      }
    };
    const maybeStartDevTouchTimer = () => {
      clearDevTouchTimer();
      devTouch.moved = false;
      const pts = Array.from(devTouch.active.values());
      if (pts.length !== 2) return;
      devTouch.startCenterX = (pts[0].x + pts[1].x) / 2;
      devTouch.startCenterY = (pts[0].y + pts[1].y) / 2;
      devTouch.timer = setTimeout(() => {
        if (devTouch.active.size === 2 && !devTouch.moved) {
          this.randomizeThemeNowAndLocale();
          this.triggerHaptic('success');
        }
      }, 650);
    };

    const processPointerMove = () => {
      this._rafPending = false;
      if (this.ignoreHover) return;
      const target = document.elementFromPoint(this._pendingX, this._pendingY);
      if (target?.classList.contains('tr-day') && !target.classList.contains('tr-day--filler')) {
        if (this._lastHoveredElement !== target) {
          if (this._lastHoveredElement) {
            this._lastHoveredElement.classList.remove('tr-is-touch-active');
          }
          target.classList.add('tr-is-touch-active');
          this._lastHoveredElement = target;
          this.triggerHaptic('scrub');
        }
        const dateText = target.dataset.trDate;
        const infoText = target.dataset.trInfo;
        this.showTooltipAt(this._pendingX, this._pendingY, true, dateText, infoText);
      } else if (this._lastHoveredElement) {
        this._lastHoveredElement.classList.remove('tr-is-touch-active');
        this._lastHoveredElement = null;
      }
    };

    const schedulePointerUpdate = (x, y) => {
      this._pendingX = x;
      this._pendingY = y;
      this.lastPointerX = x;
      this.lastPointerY = y;
      if (!this._rafPending) {
        this._rafPending = true;
        requestAnimationFrame(processPointerMove);
      }
    };

    const handlePointerDown = (e) => {
      if (e.pointerType === 'mouse') return;
      if (e.pointerType === 'touch') {
        devTouch.active.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (devTouch.active.size === 2) maybeStartDevTouchTimer();
        if (devTouch.active.size > 1) return;

        // Detect edge swipe start (left or right edge)
        const isLeftEdge = e.clientX < EDGE_THRESHOLD;
        const isRightEdge = e.clientX > window.innerWidth - EDGE_THRESHOLD;
        edgeSwipe.isFromEdge = isLeftEdge || isRightEdge;
        edgeSwipe.startX = e.clientX;
        edgeSwipe.startY = e.clientY;
      }
      activePointerId = e.pointerId;
      this.viewport.setPointerCapture(e.pointerId);
      this.startX = e.clientX;
      this.startY = e.clientY;
      isDragging = false;
      if (this.tooltipHideTimer) clearTimeout(this.tooltipHideTimer);
      schedulePointerUpdate(e.clientX, e.clientY);
      if (this._pressedElement) {
        this._pressedElement.classList.remove('tr-is-pressing');
        this._pressedElement = null;
      }
      const pressed = document.elementFromPoint(e.clientX, e.clientY);
      if (pressed?.classList?.contains('tr-day') && !pressed.classList.contains('tr-day--filler')) {
        this._pressedElement = pressed;
        pressed.classList.add('tr-is-pressing');
      }
    };

    const handlePointerMove = (e) => {
      if (e.pointerType === 'mouse') return;
      if (e.pointerType === 'touch' && devTouch.active.has(e.pointerId)) {
        devTouch.active.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (activePointerId !== e.pointerId) return;
      }
      if (activePointerId !== e.pointerId) return;
      const dx = e.clientX - this.startX;
      const dy = e.clientY - this.startY;

      // Detect edge swipe gesture
      if (edgeSwipe.isFromEdge && Math.abs(dx) > SWIPE_MIN_DISTANCE && Math.abs(dy) < 80) {
        edgeSwipe.isFromEdge = false;
        this.cycleTheme();
        this.triggerHaptic('success');
        isDragging = true;
        if (this._pressedElement) {
          this._pressedElement.classList.remove('tr-is-pressing');
          this._pressedElement = null;
        }
        return;
      }

      if (dx * dx + dy * dy > TraceEngine.DRAG_THRESHOLD_PX * TraceEngine.DRAG_THRESHOLD_PX) {
        isDragging = true;
        this.ignoreHover = false;
        if (this._pressedElement) {
          this._pressedElement.classList.remove('tr-is-pressing');
          this._pressedElement = null;
        }
      }
      schedulePointerUpdate(e.clientX, e.clientY);
    };

    const handlePointerEnd = (e) => {
      if (e.pointerType === 'mouse') return;
      if (e.pointerType === 'touch') {
        devTouch.active.delete(e.pointerId);
        if (devTouch.active.size < 2) clearDevTouchTimer();
        if (activePointerId !== e.pointerId) return;

        // Triple tap detection (only for quick taps, not drags)
        const dx = e.clientX - this.startX;
        const dy = e.clientY - this.startY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance < 10 && !isDragging) {
          handleTripleTap();
        }
      }
      if (activePointerId !== e.pointerId) return;
      activePointerId = null;
      edgeSwipe.isFromEdge = false;
      if (this._pressedElement) {
        this._pressedElement.classList.remove('tr-is-pressing');
        this._pressedElement = null;
      }
      const duration = isDragging ? TraceEngine.TOOLTIP_LINGER_MS * 0.5 : TraceEngine.TOOLTIP_LINGER_MS;
      this.tooltipHideTimer = setTimeout(() => {
        this.tooltip.style.transition = 'opacity 0.3s ease-out';
        this.tooltip.style.opacity = 0;
        if (this._lastHoveredElement) {
          this._lastHoveredElement.classList.remove('tr-is-touch-active');
          this._lastHoveredElement = null;
        }
        this.ignoreHover = false;
      }, duration);
      isDragging = false;
    };

    // If an InteractionPlugin is registered, let it own touch handling.
    if (!this.plugins?.has('InteractionPlugin')) {
      this.viewport.addEventListener('pointerdown', handlePointerDown, { passive: true, signal: this._signal });
      this.viewport.addEventListener('pointermove', handlePointerMove, { passive: true, signal: this._signal });
      this.viewport.addEventListener('pointerup', handlePointerEnd, { passive: true, signal: this._signal });
      this.viewport.addEventListener('pointercancel', handlePointerEnd, { passive: true, signal: this._signal });
    }

    let isMouseDragging = false;
    let dragStartX = 0;
    const MOUSE_DRAG_THRESHOLD = 80;
    this.viewport.addEventListener(
      'wheel',
      (e) => {
        if (!this.hasHover) return;
        if (e.ctrlKey || e.metaKey) return;
        e.preventDefault();
        if (Math.abs(e.deltaY) > 50) {
          this.cycleTheme();
          this.triggerHaptic('success');
        }
      },
      { passive: false, signal: this._signal }
    );

    this.viewport.addEventListener(
      'pointerdown',
      (e) => {
        if (!this.hasHover) return;
        if (e.pointerType !== 'mouse') return;
        dragStartX = e.clientX;
        isMouseDragging = true;
      },
      { signal: this._signal }
    );
    this.viewport.addEventListener(
      'pointermove',
      (e) => {
        if (!this.hasHover) return;
        if (!isMouseDragging || e.pointerType !== 'mouse') return;
        const dragDistance = e.clientX - dragStartX;
        if (Math.abs(dragDistance) > MOUSE_DRAG_THRESHOLD) {
          this.cycleTheme();
          this.triggerHaptic('success');
          isMouseDragging = false;
        }
      },
      { signal: this._signal }
    );
    this.viewport.addEventListener(
      'pointerup',
      () => {
        isMouseDragging = false;
      },
      { signal: this._signal }
    );
    this.viewport.addEventListener(
      'pointerleave',
      () => {
        isMouseDragging = false;
      },
      { signal: this._signal }
    );

    this._resizeObserver = new ResizeObserver(() => {
      this.debounceRender();
    });
    this._resizeObserver.observe(document.documentElement);

    this.setupEventDelegation();
    this.render();

    document.addEventListener(
      'visibilitychange',
      () => {
        if (document.hidden) this.stopTimeProgressTicker();
        else this.startTimeProgressTicker();
      },
      { signal: this._signal }
    );
    document.addEventListener('freeze', () => this.stopTimeProgressTicker(), { signal: this._signal });
    document.addEventListener('resume', () => this.startTimeProgressTicker(), { signal: this._signal });
    this.startTimeProgressTicker();
  }

  startTimeProgressTicker() {
    this.stopTimeProgressTicker();
    this.updateTimeProgress();
    const scheduleNext = () => {
      const now = this.getNow();
      const msToNextMinute =
        (60 - now.getSeconds()) * 1000 - now.getMilliseconds() + (now.getSeconds() === 0 ? 60_000 : 0);
      const delay = Math.max(250, Math.min(60_000, msToNextMinute));
      this.timeUpdateInterval = setTimeout(() => {
        this.updateTimeProgress();
        if (this.timeUpdateInterval) scheduleNext();
      }, delay);
    };
    scheduleNext();
  }
  stopTimeProgressTicker() {
    if (this.timeUpdateInterval) {
      clearTimeout(this.timeUpdateInterval);
      this.timeUpdateInterval = null;
    }
  }

  setupEventDelegation() {
    let mouseRafPending = false;
    let pendingMouseX = 0;
    let pendingMouseY = 0;
    const processMouseMove = () => {
      mouseRafPending = false;
      this.positionTooltip(pendingMouseX, pendingMouseY, false);
    };
    this.viewport.addEventListener(
      'mouseover',
      (e) => {
        if (!this.hasHover) return;
        if (this.ignoreHover) return;
        const target = e.target;
        if (target.classList.contains('tr-day') && !target.classList.contains('tr-day--filler')) {
          const dateText = target.dataset.trDate;
          const infoText = target.dataset.trInfo;
          this.showTooltipAt(e.clientX, e.clientY, false, dateText, infoText);
        }
      },
      { signal: this._signal }
    );
    this.viewport.addEventListener(
      'mousemove',
      (e) => {
        if (!this.hasHover) return;
        if (this.tooltip.style.opacity === '1') {
          pendingMouseX = e.clientX;
          pendingMouseY = e.clientY;
          if (!mouseRafPending) {
            mouseRafPending = true;
            requestAnimationFrame(processMouseMove);
          }
        }
      },
      { signal: this._signal }
    );
    this.viewport.addEventListener(
      'mouseout',
      (e) => {
        if (!this.hasHover) return;
        if (!this.viewport.contains(e.relatedTarget)) {
          this.tooltip.style.opacity = '0';
        }
      },
      { signal: this._signal }
    );

    this.viewport.addEventListener(
      'keydown',
      (e) => {
        const target = e.target;
        if (!target.classList.contains('tr-day')) return;
        const index = parseInt(target.dataset.trIndex, 10);
        if (isNaN(index)) return;
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          this.cycleTheme();
          return;
        }
        let targetIndex = -1;
        switch (e.key) {
          case 'ArrowRight':
            targetIndex = index + 1;
            break;
          case 'ArrowLeft':
            targetIndex = index - 1;
            break;
          case 'ArrowDown':
            targetIndex = index + this._currentColumns;
            break;
          case 'ArrowUp':
            targetIndex = index - this._currentColumns;
            break;
          case 'Home':
            targetIndex = 0;
            break;
          case 'End':
            targetIndex = this.gridCells.length - 1;
            break;
          default:
            return;
        }
        if (targetIndex >= 0 && targetIndex < this.gridCells.length) {
          const targetCell = this.gridCells[targetIndex];
          if (targetCell && !targetCell.classList.contains('tr-day--filler')) {
            e.preventDefault();
            targetCell.focus();
            this.srStatus.textContent = targetCell.getAttribute('aria-label');
          }
        }
      },
      { signal: this._signal }
    );

    this.viewport.addEventListener(
      'focusin',
      (e) => {
        const target = e.target;
        if (target.classList.contains('tr-day') && !target.classList.contains('tr-day--filler')) {
          const rect = target.getBoundingClientRect();
          const dateText = target.dataset.trDate;
          const infoText = target.dataset.trInfo;
          this.showTooltipAt(rect.left + rect.width / 2, rect.top + rect.height / 2, false, dateText, infoText);
        }
      },
      { signal: this._signal }
    );
    this.viewport.addEventListener(
      'focusout',
      () => {
        this.tooltip.style.opacity = '0';
      },
      { signal: this._signal }
    );
  }

  triggerHaptic(type) {
    if (!navigator.vibrate) return;
    const now = performance.now();
    const minGap = type === 'scrub' ? 90 : 350;
    if (now - (this._lastHapticAt[type] ?? 0) < minGap) return;
    this._lastHapticAt[type] = now;
    navigator.vibrate(type === 'scrub' ? TraceEngine.HAPTIC_SCRUB_MS : TraceEngine.HAPTIC_SUCCESS_MS);
  }

  updateTooltipContent(dateText, infoText) {
    const cacheKey = `${dateText}|${infoText}`;
    if (this.tooltip.dataset.cache !== cacheKey) {
      this.tooltip.textContent = '';
      const dateLine = document.createElement('span');
      dateLine.className = 'tr-tip-line';
      dateLine.textContent = dateText;
      this.tooltip.appendChild(dateLine);
      const boldInfo = document.createElement('b');
      boldInfo.className = 'tr-tip-line';
      boldInfo.textContent = infoText;
      this.tooltip.appendChild(boldInfo);
      this.tooltip.dataset.cache = cacheKey;
    }
    const rect = this.tooltip.getBoundingClientRect();
    this.tooltipWidth = rect.width;
    this.tooltipHeight = rect.height;
    this.tooltip.style.transition = 'opacity 0.2s ease-out';
    this.tooltip.style.opacity = '1';
  }
  showTooltipAt(clientX, clientY, isTouch, dateText, infoText) {
    if (!dateText || !infoText) return;
    this.updateTooltipContent(dateText, infoText);
    this.positionTooltip(clientX, clientY, isTouch);
  }

  updateDynamicColors(hex) {
    const normalized = TraceEngine.#normalizeHex(hex);
    document.documentElement.style.setProperty('--tr-base-hex', normalized);
    const cached =
      this._themeVarCache.get(normalized) ??
      (() => {
        const computed = TraceEngine.#computeThemeVars(normalized);
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
    const lum = TraceEngine.#relativeLuminanceFromHex(normalized);
    if (prevTone === 'dark') {
      nextTone = lum > TraceEngine.TONE_TO_LIGHT_LUM ? 'light' : 'dark';
    } else if (prevTone === 'light') {
      nextTone = lum < TraceEngine.TONE_TO_DARK_LUM ? 'dark' : 'light';
    }
    if (nextTone) document.documentElement.dataset.trTone = nextTone;
  }

  cycleTheme() {
    this.triggerHaptic('success');
    this.setThemeIndex(this.colorIndex + 1, { persist: true });
  }
  debounceRender() {
    if (this.resizeTimer) clearTimeout(this.resizeTimer);
    this.resizeTimer = setTimeout(() => this.render(), TraceEngine.RESIZE_DEBOUNCE_MS);
  }

  updateTimeProgress() {
    const bar = document.getElementById('tr-today-bar');
    if (!bar) return;
    const now = this.getNow();
    const minutes = now.getHours() * 60 + now.getMinutes();
    const pct = minutes / TraceEngine.MINUTES_PER_DAY;
    bar.style.transform = `scaleX(${pct})`;
  }

  positionTooltip(clientX, clientY, isTouch = false) {
    const clamp = (n, min, max) => Math.min(Math.max(n, min), max);
    const pxVar = (name) => {
      const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
      const v = Number.parseFloat(raw);
      return Number.isFinite(v) ? v : 0;
    };
    const pad = 12;
    const safeTop = pxVar('--tr-safe-top');
    const safeRight = pxVar('--tr-safe-right');
    const safeBottom = pxVar('--tr-safe-bottom');
    const safeLeft = pxVar('--tr-safe-left');
    const w = this.tooltipWidth || this.tooltip.getBoundingClientRect().width;
    const h = this.tooltipHeight || this.tooltip.getBoundingClientRect().height;
    let x = clientX;
    let y = clientY;
    const minX = safeLeft + pad + w / 2;
    const maxX = window.innerWidth - safeRight - pad - w / 2;
    x = clamp(x, minX, maxX);
    const vOffset = pxVar('--tr-tooltip-vertical-offset') || 40;
    const topBound = safeTop + pad;
    const bottomBound = window.innerHeight - safeBottom - pad;
    const aboveAnchorY = clientY - vOffset;
    const belowAnchorY = clientY + vOffset;
    const aboveFits = aboveAnchorY - h >= topBound && aboveAnchorY <= bottomBound;
    const belowFits = belowAnchorY >= topBound && belowAnchorY + h <= bottomBound;
    const spaceAbove = aboveAnchorY - topBound;
    const spaceBelow = bottomBound - belowAnchorY;
    let placeBelow;
    if (aboveFits) placeBelow = false;
    else if (belowFits) placeBelow = true;
    else placeBelow = spaceBelow > spaceAbove;
    if (placeBelow) {
      y = clamp(belowAnchorY, topBound, bottomBound - h);
      this.tooltip.style.transform = `translate3d(${Math.round(x)}px, ${Math.round(y)}px, 0) translate(-50%, 0)`;
    } else {
      y = clamp(aboveAnchorY, topBound + h, bottomBound);
      this.tooltip.style.transform = `translate3d(${Math.round(x)}px, ${Math.round(y)}px, 0) translate(-50%, -100%)`;
    }
    this.tooltip.style.left = '0px';
    this.tooltip.style.top = '0px';
  }

  render() {
    const isLeap = (this.year % 4 === 0 && this.year % 100 !== 0) || this.year % 400 === 0;
    const daysInYear = isLeap ? 366 : 365;
    const layout = this.calculateGrid(window.innerWidth, window.innerHeight, daysInYear);
    const totalCells = layout.columns * layout.rows;
    const startDate = new Date(Date.UTC(this.year, 0, 1, 12, 0, 0));
    startDate.setUTCDate(startDate.getUTCDate() - Math.floor((totalCells - daysInYear) / 2));
    this.viewport.style.cssText = `gap:${layout.gapSize}px; grid-template-columns:repeat(${layout.columns},${layout.cellSize}px); grid-template-rows:repeat(${layout.rows},${layout.cellSize}px);`;
    const fragment = document.createDocumentFragment();
    const gridCells = [];
    let todayCol = 0;
    let todayRow = 0;
    let hasToday = false;

    for (let i = 0; i < totalCells; i++) {
      const el = document.createElement('div');
      const isTargetYear = startDate.getUTCFullYear() === this.year;
      const cellDayTime = Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), startDate.getUTCDate());
      let type = 'filler';
      if (isTargetYear) {
        const currentDateStr = this.getUTCDateString(startDate);
        if (currentDateStr === this.todayStr) type = 'today';
        else if (cellDayTime < this.todayTime) type = 'past';
        else type = 'future';
      }
      el.className = `tr-day tr-day--${type}`;
      el.style.setProperty('--tr-delay', `${((i % layout.columns) + Math.floor(i / layout.columns)) * 12}ms`);
      if (startDate.getUTCDay() === 1) el.classList.add('tr-day--monday');
      if (type === 'past') {
        const diff = Math.round((this.todayTime - cellDayTime) / TraceEngine.MS_PER_DAY);
        el.style.opacity = Math.max(0.12, 1 - diff * TraceEngine.OPACITY_DECAY_RATE);
        el.style.filter = `grayscale(${Math.min(100, diff * TraceEngine.GRAYSCALE_RATE)}%)`;
      }
      if (type === 'future') {
        const diff = Math.max(0, Math.round((cellDayTime - this.todayTime) / TraceEngine.MS_PER_DAY));
        el.style.opacity = Math.max(0.28, 0.9 - diff * 0.0016);
      }
      if (type === 'today') {
        hasToday = true;
        todayCol = i % layout.columns;
        todayRow = Math.floor(i / layout.columns);
        const bar = document.createElement('div');
        bar.className = 'tr-now-indicator';
        bar.id = 'tr-today-bar';
        el.appendChild(bar);
      }
      if (isTargetYear && startDate.getUTCDate() === 1) {
        const label = this._dtfMonthLabelUTC.format(startDate).toLocaleUpperCase();
        el.setAttribute('data-tr-ghost-label', label);
        const diffDays = Math.round((cellDayTime - this.todayTime) / TraceEngine.MS_PER_DAY);
        const distance = Math.abs(diffDays);
        const monthLabelOpacity = Math.max(0.12, 0.38 - distance * 0.0014);
        el.style.setProperty('--tr-ghost-label-opacity', monthLabelOpacity.toFixed(3));
      }
      if (type !== 'filler') {
        const yearStart = Date.UTC(this.year, 0, 1, 12, 0, 0);
        const currentDate = Date.UTC(
          startDate.getUTCFullYear(),
          startDate.getUTCMonth(),
          startDate.getUTCDate(),
          12,
          0,
          0
        );
        const dayNum = Math.round((currentDate - yearStart) / TraceEngine.MS_PER_DAY) + 1;
        const dateLong = this._dtfLongUTC.format(startDate);
        const infoStr = this.formatDayInfo(dayNum, daysInYear);
        el.dataset.trDate = dateLong;
        el.dataset.trInfo = infoStr;
        el.dataset.trIndex = i.toString();
        el.setAttribute('role', 'gridcell');
        el.setAttribute('tabindex', type === 'today' ? '0' : '-1');
        if (type === 'today') this.currentFocusIndex = i;
        el.setAttribute('aria-label', `${dateLong}. ${infoStr}`);
        if (type === 'today') el.setAttribute('aria-current', 'date');
      }
      gridCells.push(el);
      fragment.appendChild(el);
      startDate.setUTCDate(startDate.getUTCDate() + 1);
    }

    this.gridCells = gridCells;
    this._currentColumns = layout.columns;
    while (this.viewport.firstChild) {
      this.viewport.removeChild(this.viewport.firstChild);
    }
    this.viewport.appendChild(fragment);
    requestAnimationFrame(() => {
      const r = this.viewport.getBoundingClientRect();
      // Round dimensions to prevent subpixel blur
      this.watermark.style.width = `${Math.round(r.width)}px`;
      this.watermark.style.height = `${Math.round(r.height)}px`;
      this.watermark.style.left = `${Math.round(this.viewport.offsetLeft)}px`;
      this.watermark.style.top = `${Math.round(this.viewport.offsetTop)}px`;

      // Dynamic stroke width based on cell size for consistent appearance
      const strokeBase = Math.max(6, Math.min(18, layout.cellSize * 0.18));
      document.documentElement.style.setProperty('--tr-year-stroke-width', `${Math.round(strokeBase)}px`);
      if (hasToday) {
        const x = (todayCol + 0.5) * (layout.cellSize + layout.gapSize) - layout.gapSize;
        const y = (todayRow + 0.5) * (layout.cellSize + layout.gapSize) - layout.gapSize;
        document.documentElement.style.setProperty('--tr-now-x', `${(x / r.width) * 100}%`);
        document.documentElement.style.setProperty('--tr-now-y', `${(y / r.height) * 100}%`);
        const radius2 = Math.max(220, Math.min(r.width, r.height) * 0.3);
        const radius1 = Math.max(130, Math.min(r.width, r.height) * 0.12);
        document.documentElement.style.setProperty('--tr-now-r1', `${Math.round(radius1)}px`);
        document.documentElement.style.setProperty('--tr-now-r2', `${Math.round(radius2)}px`);
      }
    });
    this.updateTimeProgress();
  }

  calculateGrid(viewportWidth, viewportHeight, totalDays) {
    const scaleFactor = Math.max(viewportWidth, 240) / 1200;
    const gapSize = Math.max(2, 10 * scaleFactor);
    const framePadding = Math.max(25, 50 * scaleFactor);
    const availableWidth = viewportWidth - framePadding * 2;
    const availableHeight = viewportHeight - framePadding * 2;
    const idealColumns = Math.sqrt((totalDays * availableWidth) / availableHeight);
    const searchStart = Math.max(1, Math.floor(idealColumns * 0.7));
    const searchEnd = Math.min(totalDays, Math.ceil(idealColumns * 1.3));
    let bestCellSize = 0;
    let bestColumns = 1;
    for (let columns = searchStart; columns <= searchEnd; columns++) {
      const rows = Math.ceil(totalDays / columns);
      const cellSize = Math.min(
        Math.floor((availableWidth + gapSize) / columns) - gapSize,
        Math.floor((availableHeight + gapSize) / rows) - gapSize
      );
      if (cellSize > bestCellSize) {
        bestCellSize = cellSize;
        bestColumns = columns;
      }
    }
    const cellSize = Math.floor(bestCellSize);
    const columns = Math.floor((availableWidth + gapSize) / (cellSize + gapSize));
    const rows = Math.floor((availableHeight + gapSize) / (cellSize + gapSize));
    return { cellSize, gapSize, columns, rows };
  }

  destroy() {
    if (this.pressTimer) clearTimeout(this.pressTimer);
    if (this.tooltipHideTimer) clearTimeout(this.tooltipHideTimer);
    if (this.resizeTimer) clearTimeout(this.resizeTimer);
    this.stopTimeProgressTicker();
    if (this._resizeObserver) this._resizeObserver.disconnect();
    if (this._ac) this._ac.abort();
    while (this.viewport.firstChild) {
      this.viewport.removeChild(this.viewport.firstChild);
    }
  }

  getColorForYear(year) {
    const map = this.colorOfYearMap;
    const keys = Object.keys(map)
      .map((y) => parseInt(y, 10))
      .sort((a, b) => a - b);
    const derivedMin = keys[0];
    const derivedMax = keys[keys.length - 1];
    const minSupported = Number.isFinite(this._supportedYearMin) ? this._supportedYearMin : derivedMin;
    const maxSupported = Number.isFinite(this._supportedYearMax) ? this._supportedYearMax : derivedMax;
    const y = Number.parseInt(year, 10);
    if (Number.isNaN(y)) return map[derivedMax];
    if (y <= minSupported) return map[derivedMin] || map[minSupported] || map[derivedMax];
    if (y >= maxSupported) {
      const base = map[derivedMax];
      const rgb = TraceEngine.#hexToRgb01(base);
      if (!rgb) return base;
      const r = Math.round(rgb.r * 255);
      const g = Math.round(rgb.g * 255);
      const b = Math.round(rgb.b * 255);
      const { h, s, l } = TraceEngine.#rgbToHsl(r, g, b);
      const shift = ((y - derivedMax) * 6) % 360;
      const newRgb = TraceEngine.#hslToRgb((h + shift) % 360, s, l);
      return TraceEngine.#rgbToHex(newRgb.r, newRgb.g, newRgb.b);
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
      this.announcer.innerText = `Theme color set for ${year}`;
    } catch (e) {
      console.warn('setThemeByYear failed', e);
    }
  }

  static #rgbToHsl(r, g, b) {
    r /= 255;
    g /= 255;
    b /= 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h = 0;
    let s = 0;
    const l = (max + min) / 2;
    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r:
          h = (g - b) / d + (g < b ? 6 : 0);
          break;
        case g:
          h = (b - r) / d + 2;
          break;
        case b:
          h = (r - g) / d + 4;
          break;
      }
      h *= 60;
    }
    return { h, s, l };
  }
  static #hslToRgb(h, s, l) {
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const hh = h / 60;
    const x = c * (1 - Math.abs((hh % 2) - 1));
    let r1 = 0,
      g1 = 0,
      b1 = 0;
    if (0 <= hh && hh < 1) [r1, g1, b1] = [c, x, 0];
    else if (1 <= hh && hh < 2) [r1, g1, b1] = [x, c, 0];
    else if (2 <= hh && hh < 3) [r1, g1, b1] = [0, c, x];
    else if (3 <= hh && hh < 4) [r1, g1, b1] = [0, x, c];
    else if (4 <= hh && hh < 5) [r1, g1, b1] = [x, 0, c];
    else [r1, g1, b1] = [c, 0, x];
    const m = l - c / 2;
    return { r: Math.round((r1 + m) * 255), g: Math.round((g1 + m) * 255), b: Math.round((b1 + m) * 255) };
  }
  static #rgbToHex(r, g, b) {
    const toHex = (n) => n.toString(16).padStart(2, '0').toUpperCase();
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  }
}
