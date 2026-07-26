import { formatFullDate } from '../core/date-utils.js';
import { renderRichText } from '../core/rich-text.js';
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
  #preview;
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

    // An existing note opens as formatted text; an empty day opens ready to
    // type. Either way recording a day still costs one gesture.
    this.#setEditing(!entry.note);
    this.#dialog.showModal();
    if (!entry.note) this.#textarea.focus();
  }

  close() {
    if (this.#dialog.open) this.#dialog.close();
  }

  // Preview and editor are the same content in two modes; only one shows.
  #setEditing(editing) {
    this.#textarea.hidden = !editing;
    this.#preview.hidden = editing;
    if (editing) return;
    this.#preview.replaceChildren(renderRichText(this.#textarea.value));
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

    this.#preview = document.createElement('div');
    this.#preview.className = 'day-panel-preview';
    this.#preview.tabIndex = 0;
    this.#preview.setAttribute('role', 'button');
    this.#preview.setAttribute('aria-label', 'Catatan hari ini, klik untuk menyunting');
    const toEdit = () => {
      this.#setEditing(true);
      this.#textarea.focus();
    };
    this.#preview.addEventListener('click', toEdit);
    this.#preview.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        toEdit();
      }
    });

    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'day-panel-delete';
    deleteBtn.textContent = 'Hapus';
    deleteBtn.addEventListener('click', () => {
      this.#store.clear(this.#currentKey);
      this.#renderMoods('');
      this.#textarea.value = '';
      this.#setEditing(true);
      this.#textarea.focus();
    });

    const actions = document.createElement('div');
    actions.className = 'day-panel-actions';

    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'day-panel-done';
    closeBtn.textContent = 'Selesai';
    closeBtn.addEventListener('click', () => this.close());

    actions.append(deleteBtn, closeBtn);
    dialog.append(this.#title, this.#moodRow, this.#preview, this.#textarea, actions);

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
