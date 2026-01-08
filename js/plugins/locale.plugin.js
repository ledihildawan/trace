// TRACE Locale Plugin (i18n)
// Internationalization and locale management

import { TracePlugin } from '../core/plugin-manager.js';

export class LocalePlugin extends TracePlugin {
  constructor() {
    super('LocalePlugin');
    this._activeLocale = null;
    this._localeOverride = null;
    this._lang = 'en';
    this._t = null;
  }

  init(engine) {
    super.init(engine);

    // Initialize i18n dictionary
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

    // Detect and set initial locale
    const langPrimaryRaw = (navigator.language ?? 'en').toLowerCase().split('-')[0];
    const langAlias = { jp: 'ja', gr: 'de' };
    const langPrimary = langAlias[langPrimaryRaw] ?? langPrimaryRaw;
    this._lang = this._i18n[langPrimary] ? langPrimary : 'en';
    this._t = this._i18n[this._lang] ?? this._i18n.en;

    // Set to user's system language
    this.setLocale(navigator.language ?? 'en', { announce: false, render: false });
  }

  /**
   * Set active locale
   */
  setLocale(locale, { announce = false, render = true, override = false } = {}) {
    const activeLocale = locale || 'en';
    if (override) this._localeOverride = activeLocale;
    this._activeLocale = activeLocale;
    
    document.documentElement.lang = activeLocale;
    
    const primaryRaw = activeLocale.toLowerCase().split('-')[0];
    const rtlLangs = new Set(['ar', 'fa', 'he', 'iw', 'ur', 'ps']);
    if (rtlLangs.has(primaryRaw)) {
      document.documentElement.dir = 'rtl';
    } else {
      document.documentElement.removeAttribute('dir');
    }

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

    if (announce && this.engine.announcer) {
      this.engine.announcer.innerText = this._t.localeChanged
        ? this._t.localeChanged(activeLocale)
        : `Language changed: ${activeLocale}`;
    }
    
    if (render) {
      this.engine.render();
    }
  }

  /**
   * Randomize locale for testing
   */
  randomizeLocale({ announce = false, render = true } = {}) {
    const current = this._activeLocale ?? 'en';
    const candidates = this._testLocales.filter((l) => l !== current);
    const next = candidates.length ? candidates[Math.floor(Math.random() * candidates.length)] : current;
    this.setLocale(next, { announce, render, override: true });
  }

  /**
   * Format day info with locale-specific formatting
   */
  formatDayInfo(dayNum, daysInYear) {
    const dayStr = this._nfInteger.format(dayNum);
    const pctStr = this._nfPercent1.format(dayNum / daysInYear);
    if (typeof this._t.formatDayInfo === 'function') {
      return this._t.formatDayInfo(dayStr, pctStr);
    }
    const dayLabel = this._t.dayLabel ?? 'Day';
    const ofYear = this._t.ofThisYear ?? 'of this year';
    return `${dayLabel} ${dayStr} • ${pctStr} ${ofYear}`;
  }
}
