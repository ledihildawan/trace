import { formatFullDate } from '../core/date-utils.js';
import { DayStore, MOODS } from '../systems/day-store.js';

// Modal detail for a single day: full date, a mood picker, and a free-text note.
// All edits flow straight into the DayStore (localStorage) and notify listeners.
//
// Built on <dialog>.showModal(), which the platform already implements better
// than hand-rolled code: top-layer stacking (no z-index race), a real focus
// trap, `inert` background content, Escape-to-close, and focus restored to
// whatever was focused before opening.
export class DayPanel {
  #store;
  #opts;
  #dialog;
  #title;
  #moodRow;
  #textarea;
  #currentKey = null;

  constructor(store, opts = {}) {
    this.#store = store;
    this.#opts = opts;
    this.#build();
  }

  isOpen() {
    return this.#dialog.open;
  }

  open(date) {
    this.#currentKey = DayStore.keyOf(date);
    this.#title.textContent = formatFullDate(date);

    const entry = this.#store.get(this.#currentKey) || {};
    this.#renderMoods(entry.mood || '');
    this.#textarea.value = entry.note || '';

    this.#dialog.showModal();
    this.#textarea.focus();
  }

  close() {
    if (this.#dialog.open) this.#dialog.close();
  }

  #renderMoods(selected) {
    this.#moodRow.replaceChildren();
    MOODS.forEach((m) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'mood-btn';
      btn.setAttribute('aria-label', m.label);
      btn.setAttribute('aria-pressed', String(m.key === selected));
      btn.title = m.label;
      btn.style.background = m.color;
      btn.addEventListener('click', () => {
        const current = this.#store.get(this.#currentKey);
        const next = current?.mood === m.key ? '' : m.key;
        this.#store.setMood(this.#currentKey, next);
        this.#renderMoods(next);
      });
      this.#moodRow.append(btn);
    });
  }

  #build() {
    const dialog = document.createElement('dialog');
    dialog.className = 'day-panel';
    // The scrim is ::backdrop, so the dialog element itself is the card.

    this.#title = document.createElement('div');
    this.#title.className = 'day-panel-title';
    this.#title.id = 'day-panel-title';
    dialog.setAttribute('aria-labelledby', this.#title.id);

    this.#moodRow = document.createElement('div');
    this.#moodRow.className = 'day-panel-moods';
    this.#moodRow.setAttribute('role', 'group');
    this.#moodRow.setAttribute('aria-label', 'Suasana hari');

    this.#textarea = document.createElement('textarea');
    this.#textarea.className = 'day-panel-note';
    this.#textarea.placeholder = 'Catatan hari ini...';
    this.#textarea.rows = 4;
    this.#textarea.setAttribute('aria-label', 'Catatan hari ini');
    this.#textarea.addEventListener('input', () => {
      this.#store.setNote(this.#currentKey, this.#textarea.value);
    });

    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'day-panel-done';
    closeBtn.textContent = 'Selesai';
    closeBtn.addEventListener('click', () => this.close());

    dialog.append(this.#title, this.#moodRow, this.#textarea, closeBtn);

    // Light-dismiss: showModal() sizes the dialog to its content, so a click
    // landing on the element itself came from the backdrop area.
    dialog.addEventListener('click', (e) => {
      if (e.target === dialog) this.close();
    });

    // Fires for Escape and for close() alike — the single teardown path.
    dialog.addEventListener('close', () => {
      this.#store.flush?.();
      this.#opts?.onClose?.();
    });

    // Keep the app's single-letter shortcuts from firing while typing here.
    dialog.addEventListener('keydown', (e) => e.stopPropagation());

    this.#dialog = dialog;
    document.body.append(dialog);
  }
}
