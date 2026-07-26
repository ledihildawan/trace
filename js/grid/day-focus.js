import { OdysseyConfig } from '../config/odyssey-config.js';

const C = OdysseyConfig.classes;
const DAY_CELL = `.${C.cell}[data-month]`;

// Owns "which day is focused" and the WAI-ARIA roving tabindex.
//
// Every cell renders as tabindex="-1", so without exactly one designated tab
// stop the calendar is unreachable by Tab and only enterable via F or a click.
// This keeps that single stop correct as blocks are recycled and focus moves.
export class DayFocus {
  #resolveBlock;
  #today;
  #date = null;
  #cell = null;
  #tabStop = null;

  // `resolveBlock(year)` returns the rendered year block, or undefined.
  constructor(canvas, { resolveBlock, today }) {
    this.#resolveBlock = resolveBlock;
    this.#today = today;

    // Single source of truth: whether focus arrived by Tab, click, or
    // programmatically, it lands here and state stays consistent.
    canvas.addEventListener('focusin', (e) => {
      const cell = e.target?.closest?.(DAY_CELL);
      if (cell) this.#adopt(cell);
    });
  }

  get date() { return this.#date; }
  get cell() { return this.#cell; }

  set date(value) { this.#date = value; }

  // True when a real (non-filler) day cell currently has focus.
  isCellFocused() {
    const el = document.activeElement;
    return !!el
      && el.classList?.contains(C.cell) === true
      && !el.classList.contains(C.filler);
  }

  cellFor(block, date) {
    return block.querySelector(
      `.${C.cell}[data-month="${date.getMonth()}"][data-date="${date.getDate()}"]`
    );
  }

  // Moves DOM focus to `date` within an already-rendered block.
  focusIn(block, date) {
    const cell = this.cellFor(block, date);
    if (!cell) return false;
    this.#date = date;
    cell.focus();
    return true;
  }

  restoreFocus() {
    if (this.#cell?.isConnected) this.#cell.focus();
  }

  // Ensures the year the user is looking at owns the tab stop. Preference:
  // the focused day, else today, else the first day of that year.
  refreshTabStop(year) {
    const owner = this.#tabStop?.isConnected
      ? this.#tabStop.closest(`.${C.yearBlock}`)
      : null;
    if (owner && parseInt(owner.dataset.year, 10) === year) return;

    const block = this.#resolveBlock(year);
    if (!block) return;
    const target =
      (this.#date?.getFullYear() === year && this.cellFor(block, this.#date))
      || (this.#today.getFullYear() === year && this.cellFor(block, this.#today))
      || block.querySelector(DAY_CELL);
    this.#setTabStop(target || null);
  }

  #adopt(cell) {
    const block = cell.closest(`.${C.yearBlock}`);
    const year = parseInt(block?.dataset.year, 10);
    const month = parseInt(cell.dataset.month, 10);
    const date = parseInt(cell.dataset.date, 10);
    if (Number.isNaN(year) || Number.isNaN(month) || Number.isNaN(date)) return;
    this.#cell = cell;
    this.#date = new Date(year, month, date);
    this.#setTabStop(cell);
  }

  #setTabStop(cell) {
    if (this.#tabStop === cell) return;
    if (this.#tabStop?.isConnected) this.#tabStop.setAttribute('tabindex', '-1');
    this.#tabStop = cell ?? null;
    cell?.setAttribute('tabindex', '0');
  }
}
