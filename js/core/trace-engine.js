// TRACE Core Engine (Minimal)
// Framework-agnostic core with plugin architecture

import { GRAYSCALE_RATE, MS_PER_DAY, OPACITY_DECAY_RATE, RESIZE_DEBOUNCE_MS } from './constants.js';
import { PluginManager } from './plugin-manager.js';

export class TraceEngine {
  /**
   * @param {Object} options
   * @param {string[]} options.themeColors - Palette to cycle through
   * @param {Record<number,string>} options.colorOfYearMap - Year→hex mapping
   * @param {HTMLElement} [options.viewport]
   * @param {HTMLElement} [options.watermark]
   */
  constructor({
    themeColors = ['#F6F2EA'],
    colorOfYearMap = {},
    viewport = document.getElementById('tr-viewport'),
    watermark = document.getElementById('tr-year-watermark'),
  } = {}) {
    this.themeColors = themeColors;
    this.colorOfYearMap = colorOfYearMap;

    this.viewport = viewport;
    this.watermark = watermark;

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
   * Render the calendar grid - Absolute Maximum Performance
   */
  render() {
    const localePlugin = this.plugins.get('LocalePlugin');
    const hasLocale = !!localePlugin;

    const year = this.year;
    const isLeap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
    const daysInYear = isLeap ? 366 : 365;
    const layout = this.calculateGrid(window.innerWidth, window.innerHeight, daysInYear);
    const { gapSize, cellSize, columns } = layout;
    const totalCells = layout.columns * layout.rows;

    const startDate = new Date(Date.UTC(year, 0, 1, 12, 0, 0));
    startDate.setUTCDate(startDate.getUTCDate() - Math.floor((totalCells - daysInYear) / 2));

    // Single viewport style assignment
    this.viewport.style.cssText = `gap:${gapSize}px;grid-template-columns:repeat(${columns},${cellSize}px);grid-template-rows:repeat(${layout.rows},${cellSize}px)`;

    const fragment = document.createDocumentFragment();
    let todayCol = 0;
    let todayRow = 0;
    let hasToday = false;

    // Pre-calculate ALL constants outside loop
    const yearStart = Date.UTC(year, 0, 1, 12, 0, 0);
    const todayStr = this.todayStr;
    const todayTime = this.todayTime;
    const dayFactor = 1 / MS_PER_DAY;
    const opacityRate = OPACITY_DECAY_RATE;
    const grayRate = GRAYSCALE_RATE;

    // Main render loop
    for (let i = 0; i < totalCells; i++) {
      const el = document.createElement('div');

      // Cache ALL date properties
      const y = startDate.getUTCFullYear();
      const m = startDate.getUTCMonth();
      const d = startDate.getUTCDate();
      const wd = startDate.getUTCDay();
      const col = i % columns;
      const row = (i / columns) | 0;

      const isTargetYear = y === year;
      const cellTime = Date.UTC(y, m, d);

      let type = 'filler';
      let diff = 0;

      if (isTargetYear) {
        if (`${d} ${m} ${y}` === todayStr) {
          type = 'today';
          hasToday = true;
          todayCol = col;
          todayRow = row;
        } else {
          diff = ((todayTime - cellTime) * dayFactor + 0.5) | 0;
          type = diff > 0 ? 'past' : 'future';
        }
      }

      // Inline className with single ternary
      el.className = wd === 1 ? `tr-day tr-day--${type} tr-day--monday` : `tr-day tr-day--${type}`;

      // Ultra-optimized cssText building
      let css = `--tr-delay:${(col + row) * 12}ms`;

      if (type === 'past') {
        const op = Math.max(0.12, 1 - diff * opacityRate);
        const gray = Math.min(100, diff * grayRate);
        css += `;opacity:${op};filter:grayscale(${gray}%)`;
      } else if (type === 'future') {
        css += `;opacity:${Math.max(0.28, 0.9 + diff * 0.0016)}`;
      }

      el.style.cssText = css;

      // Today bar creation
      if (type === 'today') {
        const bar = document.createElement('div');
        bar.className = 'tr-now-indicator';
        bar.id = 'tr-today-bar';
        el.appendChild(bar);
      }

      // Consolidated locale operations
      if (isTargetYear && hasLocale) {
        if (d === 1) {
          el.setAttribute('data-tr-ghost-label', localePlugin._dtfMonthLabelUTC.format(startDate).toLocaleUpperCase());
          el.style.setProperty('--tr-ghost-label-opacity', Math.max(0.12, 0.38 - Math.abs(diff) * 0.0014).toFixed(3));
        }

        if (type !== 'filler') {
          el.dataset.trDate = localePlugin._dtfLongUTC.format(startDate);
          el.dataset.trInfo = localePlugin.formatDayInfo(
            ((cellTime - yearStart) * dayFactor + 0.5) | (0 + 1),
            daysInYear
          );
        }
      }

      fragment.appendChild(el);
      startDate.setUTCDate(d + 1);
    }

    this._currentColumns = columns;
    this.viewport.replaceChildren(fragment);

    // Optimized RAF with minimal calculations
    requestAnimationFrame(() => {
      const r = this.viewport.getBoundingClientRect();
      const w = (r.width + 0.5) | 0;
      const h = (r.height + 0.5) | 0;

      this.watermark.style.cssText = `width:${w}px;height:${h}px;left:${(this.viewport.offsetLeft + 0.5) | 0}px;top:${
        (this.viewport.offsetTop + 0.5) | 0
      }px`;

      const rootStyle = document.documentElement.style;
      rootStyle.setProperty('--tr-year-stroke-width', `${(Math.max(6, Math.min(18, cellSize * 0.18)) + 0.5) | 0}px`);

      if (hasToday) {
        const x = (todayCol + 0.5) * (cellSize + gapSize) - gapSize;
        const y = (todayRow + 0.5) * (cellSize + gapSize) - gapSize;
        const minDim = w < h ? w : h;

        rootStyle.setProperty('--tr-now-x', `${(x / w) * 100}%`);
        rootStyle.setProperty('--tr-now-y', `${(y / h) * 100}%`);
        rootStyle.setProperty('--tr-now-r1', `${(Math.max(130, minDim * 0.12) + 0.5) | 0}px`);
        rootStyle.setProperty('--tr-now-r2', `${(Math.max(220, minDim * 0.3) + 0.5) | 0}px`);
      }
    });
  }

  /**
   * Grid Calculation Engine (Pure Logic - V2 Final)
   * Fokus: Kalkulasi koordinat, distribusi sisa ruang, dan manajemen kapasitas.
   */
  calculateGrid(viewportWidth, viewportHeight, totalItems, options = {}) {
    const {
      minCellSize = 24,
      maxCellSize = 180,
      preferredAspectRatio = null,
      strictAspect = false,
      referenceWidth = 1200,
      gapMultiplier = 10,
      paddingMultiplier = 48,
      minGap = 4,
      minPadding = 24,
      // Konfigurasi Core Alignment & Limit
      horizontalAlign = 'center', // 'start', 'center', 'end'
      verticalAlign = 'center', // 'start', 'center', 'end'
      lastRowAlign = 'center', // 'start', 'center'
      maxRows = Infinity, // Membatasi jumlah baris maksimal
    } = options;

    // 1. Guard Clauses & Input Sanitization
    if (totalItems <= 0 || viewportWidth <= 0 || viewportHeight <= 0) {
      return { cellSize: 0, gapSize: minGap, columns: 0, rows: 0, capacity: 0, itemsRendered: 0 };
    }

    // 2. Skala Fisik Berdasarkan Reference Width
    const scale = Math.max(1, viewportWidth / referenceWidth);
    const gapSize = Math.max(minGap, Math.round(scale * gapMultiplier));
    const padding = Math.max(minPadding, Math.round(scale * paddingMultiplier));

    const availW = Math.max(0, viewportWidth - 2 * padding);
    const availH = Math.max(0, viewportHeight - 2 * padding);

    // 3. Estimasi Target & Range Kolom
    let targetAspect = preferredAspectRatio ?? availW / availH;
    targetAspect = Math.max(0.45, Math.min(3.2, targetAspect));

    const idealCols = Math.sqrt(totalItems * targetAspect);
    const rangeFactor = totalItems <= 10 ? 0.85 : totalItems <= 35 ? 0.6 : 0.25;

    let minCols = Math.max(1, Math.floor(idealCols * (1 - rangeFactor)));
    let maxCols = Math.min(totalItems, Math.ceil(idealCols * (1 + rangeFactor)));

    const maxPossibleCols = Math.floor((availW + gapSize) / (minCellSize + gapSize));
    maxCols = Math.min(maxCols, maxPossibleCols, totalItems);

    // 4. Optimization Loop (Mencari CellSize & Column terbaik)
    let best = null;
    const penaltyFactor = strictAspect ? 8000 : 4000;

    for (let cols = minCols; cols <= maxCols; cols++) {
      let rows = Math.ceil(totalItems / cols);

      // Jika rows melebihi limit, hitung ulang dengan totalItems yang dipotong
      const isRowLimited = rows > maxRows;
      const effectiveRows = isRowLimited ? maxRows : rows;

      const cellW = Math.floor((availW + gapSize) / cols) - gapSize;
      const cellH = Math.floor((availH + gapSize) / effectiveRows) - gapSize;

      let cellSize = Math.min(cellW, cellH, maxCellSize);
      if (cellSize < minCellSize * 0.5) continue;

      const currentAspect = cols / effectiveRows;
      const aspectDiff = Math.abs(currentAspect - targetAspect);
      const area = cellSize * cellSize;

      // Skor: Luas area besar lebih baik, tapi perbedaan aspect ratio jadi penalti
      const score = area - aspectDiff * penaltyFactor;

      if (!best || score > best.score) {
        best = {
          cellSize,
          columns: cols,
          rows: effectiveRows,
          score,
          actualTotalItems: isRowLimited ? cols * maxRows : totalItems,
        };
      }
    }

    // 5. Finalisasi Logic Data
    const config = best || {
      cellSize: Math.min(availW / Math.max(1, Math.round(idealCols)), maxCellSize),
      columns: Math.max(1, Math.round(idealCols)),
      rows: Math.min(maxRows, Math.ceil(totalItems / Math.max(1, Math.round(idealCols)))),
      actualTotalItems: totalItems,
    };

    const finalCellSize = Math.floor(config.cellSize);
    const itemsToRender = Math.min(totalItems, config.columns * config.rows);

    // 6. Kalkulasi Koordinat Global (Centering/Alignment Logic)
    const totalGridW = config.columns * finalCellSize + (config.columns - 1) * gapSize;
    const totalGridH = config.rows * finalCellSize + (config.rows - 1) * gapSize;

    let baseOffsetX = padding;
    if (horizontalAlign === 'center') baseOffsetX += (availW - totalGridW) / 2;
    if (horizontalAlign === 'end') baseOffsetX += availW - totalGridW;

    let baseOffsetY = padding;
    if (verticalAlign === 'center') baseOffsetY += (availH - totalGridH) / 2;
    if (verticalAlign === 'end') baseOffsetY += availH - totalGridH;

    // Offset Baris Terakhir
    const lastRowItems = itemsToRender % config.columns || config.columns;
    const lastRowWidth = lastRowItems * finalCellSize + (lastRowItems - 1) * gapSize;
    const lastRowXOffset = lastRowAlign === 'center' ? (totalGridW - lastRowWidth) / 2 : 0;

    return {
      // Hasil Dimensi
      columns: config.columns,
      rows: config.rows,
      cellSize: finalCellSize,
      gapSize,
      padding,

      // Metadata Data & Kapasitas
      totalItemsRequested: totalItems,
      itemsRendered: itemsToRender,
      isOverflowing: totalItems > itemsToRender || totalGridH > availH,
      fillRatio: (itemsToRender * finalCellSize ** 2) / (availW * availH || 1),

      // Fungsi Koordinat
      getItemPosition: (index) => {
        if (index >= itemsToRender) return null; // Tidak perlu render jika di luar limit

        const row = Math.floor(index / config.columns);
        const col = index % config.columns;
        const isLastRow = row === config.rows - 1;

        let x = baseOffsetX + col * (finalCellSize + gapSize);
        if (isLastRow) x += lastRowXOffset;

        const y = baseOffsetY + row * (finalCellSize + gapSize);

        return { x, y, row, col };
      },
    };
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
