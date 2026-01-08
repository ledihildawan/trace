// TRACE Core Engine (Minimal)
// Framework-agnostic core with plugin architecture

import { PluginManager } from './plugin-manager.js';
import { MS_PER_DAY, OPACITY_DECAY_RATE, GRAYSCALE_RATE, RESIZE_DEBOUNCE_MS } from './constants.js';

export class TraceEngine {
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

    // Plugin system
    this.plugins = new PluginManager(this);

    // Year range (optional)
    this._supportedYearMin = null;
    this._supportedYearMax = null;

    // Time state
    this._simulatedNow = null;
    this.year = null;
    this.todayStr = null;
    this.todayTime = null;

    // Theme state
    this.colorIndex = 0;

    // Render state
    this.gridCells = [];
    this._currentColumns = 0;
    this.resizeTimer = null;

    // Initialize with current time
    this.applyNow(this.getNow());

    // Setup resize observer
    this._resizeObserver = new ResizeObserver(() => {
      this.debounceRender();
    });
    this._resizeObserver.observe(document.documentElement);
  }

  /**
   * Get current time (real or simulated)
   */
  getNow() {
    return this._simulatedNow ?? new Date();
  }

  /**
   * Apply time state
   */
  applyNow(now) {
    this.year = now.getUTCFullYear();
    this.todayStr = this.getUTCDateString(now);
    this.todayTime = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
    this.watermark.innerText = this.year;
    this.watermark.dataset.trYear = String(this.year);
  }

  /**
   * Get UTC date string (for comparison)
   */
  getUTCDateString(date) {
    return `${date.getUTCDate()} ${date.getUTCMonth()} ${date.getUTCFullYear()}`;
  }

  /**
   * Initialize engine and plugins
   */
  init() {
    // Plugins will be registered externally via app.js
    console.log('[TraceEngine] Core initialized');
  }

  /**
   * Debounce render on resize
   */
  debounceRender() {
    if (this.resizeTimer) clearTimeout(this.resizeTimer);
    this.resizeTimer = setTimeout(() => this.render(), RESIZE_DEBOUNCE_MS);
  }

  /**
   * Render the calendar grid
   */
  render() {
    const localePlugin = this.plugins.get('LocalePlugin');
    
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

    const a11yPlugin = this.plugins.get('A11yPlugin');

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
        const diff = Math.round((this.todayTime - cellDayTime) / MS_PER_DAY);
        el.style.opacity = Math.max(0.12, 1 - diff * OPACITY_DECAY_RATE);
        el.style.filter = `grayscale(${Math.min(100, diff * GRAYSCALE_RATE)}%)`;
      }
      
      if (type === 'future') {
        const diff = Math.max(0, Math.round((cellDayTime - this.todayTime) / MS_PER_DAY));
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
      
      if (isTargetYear && startDate.getUTCDate() === 1 && localePlugin) {
        const label = localePlugin._dtfMonthLabelUTC.format(startDate).toLocaleUpperCase();
        el.setAttribute('data-tr-ghost-label', label);
        const diffDays = Math.round((cellDayTime - this.todayTime) / MS_PER_DAY);
        const distance = Math.abs(diffDays);
        const monthLabelOpacity = Math.max(0.12, 0.38 - distance * 0.0014);
        el.style.setProperty('--tr-ghost-label-opacity', monthLabelOpacity.toFixed(3));
      }
      
      if (type !== 'filler' && localePlugin) {
        const yearStart = Date.UTC(this.year, 0, 1, 12, 0, 0);
        const currentDate = Date.UTC(
          startDate.getUTCFullYear(),
          startDate.getUTCMonth(),
          startDate.getUTCDate(),
          12,
          0,
          0
        );
        const dayNum = Math.round((currentDate - yearStart) / MS_PER_DAY) + 1;
        const dateLong = localePlugin._dtfLongUTC.format(startDate);
        const infoStr = localePlugin.formatDayInfo(dayNum, daysInYear);
        el.dataset.trDate = dateLong;
        el.dataset.trInfo = infoStr;
        
        // A11y setup
        if (a11yPlugin) {
          a11yPlugin.setupCellA11y(el, {
            type,
            dateLong,
            infoStr,
            isToday: type === 'today',
            index: i
          });
        }
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

      // Dynamic stroke width based on cell size
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

    // Notify plugins of render
    for (const plugin of this.plugins.plugins.values()) {
      if (typeof plugin.onRender === 'function') {
        plugin.onRender();
      }
    }
  }

  /**
   * Calculate optimal grid layout
   */
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

  /**
   * Destroy engine and cleanup
   */
  destroy() {
    if (this.resizeTimer) clearTimeout(this.resizeTimer);
    if (this._resizeObserver) this._resizeObserver.disconnect();
    if (this._ac) this._ac.abort();
    
    // Destroy all plugins
    this.plugins.destroyAll();
    
    while (this.viewport.firstChild) {
      this.viewport.removeChild(this.viewport.firstChild);
    }
    
    console.log('[TraceEngine] Core destroyed');
  }
}
