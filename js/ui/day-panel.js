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
  #saveStatus;
  #deleteBtn;
  #confirmDialog;
  #deletePending = false;
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
    this.#updateDeleteAvailability();

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

      const dot = document.createElement('span');
      dot.className = 'mood-dot';
      dot.style.background = m.color;
      dot.setAttribute('aria-hidden', 'true');

      const label = document.createElement('span');
      label.className = 'mood-label';
      label.textContent = m.label;

      btn.addEventListener('click', () => {
        const current = this.#store.get(this.#currentKey);
        const next = current?.mood === m.key ? '' : m.key;
        this.#showSaving();
        this.#store.setMood(this.#currentKey, next);
        this.#renderMoods(next);
      });
      btn.append(dot, label);
      this.#moodRow.append(btn);
    });
    this.#updateDeleteAvailability();
  }

  #updateDeleteAvailability() {
    if (!this.#deleteBtn || !this.#currentKey) return;
    const entry = this.#store.get(this.#currentKey);
    const hasContent = Boolean(entry?.note?.trim() || entry?.mood);
    this.#deleteBtn.disabled = this.#deletePending || !hasContent;
  }

  #showSaving() {
    this.#saveStatus.textContent = 'Menyimpan…';
  }

  #requestDeleteConfirmation() {
    if (!this.#confirmDialog) this.#confirmDialog = this.#buildDeleteConfirmation();
    const dialog = this.#confirmDialog;
    dialog.returnValue = '';

    return new Promise((resolve) => {
      dialog.addEventListener('close', () => {
        resolve(dialog.returnValue === 'confirm');
      }, { once: true });
      dialog.showModal();
    });
  }

  #buildDeleteConfirmation() {
    const dialog = document.createElement('dialog');
    dialog.className = 'day-panel-confirm';
    dialog.setAttribute('aria-labelledby', 'day-panel-confirm-title');
    dialog.setAttribute('aria-describedby', 'day-panel-confirm-description');

    const title = document.createElement('h2');
    title.id = 'day-panel-confirm-title';
    title.textContent = 'Hapus catatan hari ini?';

    const description = document.createElement('p');
    description.id = 'day-panel-confirm-description';
    description.textContent = 'Catatan dan suasana yang tersimpan akan dihapus.';

    const actions = document.createElement('div');
    actions.className = 'day-panel-confirm-actions';

    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.className = 'day-panel-confirm-cancel';
    cancel.textContent = 'Batal';
    cancel.addEventListener('click', () => dialog.close('cancel'));

    const accept = document.createElement('button');
    accept.type = 'button';
    accept.className = 'day-panel-confirm-accept';
    accept.textContent = 'Hapus';
    accept.addEventListener('click', () => dialog.close('confirm'));

    actions.append(cancel, accept);
    dialog.append(title, description, actions);
    document.body.append(dialog);
    return dialog;
  }

  async #deleteCurrentDay() {
    if (this.#deletePending || this.#deleteBtn.disabled) return;
    const key = this.#currentKey;
    this.#deletePending = true;
    this.#updateDeleteAvailability();
    try {
      const confirmDelete = this.#opts.confirmDelete
        ?? (() => this.#requestDeleteConfirmation());
      const allowed = await Promise.resolve(confirmDelete());
      if (!allowed || !this.#dialog.open || this.#currentKey !== key) return;

      this.#showSaving();
      this.#store.clear(key);
      this.#renderMoods('');
      this.#textarea.value = '';
      this.#setEditing(true);
      this.#textarea.focus();
    } finally {
      this.#deletePending = false;
      this.#updateDeleteAvailability();
    }
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
      this.#showSaving();
      this.#store.setNote(this.#currentKey, this.#textarea.value);
      this.#updateDeleteAvailability();
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

    const formatHint = document.createElement('p');
    formatHint.className = 'day-panel-format-hint';
    formatHint.textContent = '**tebal** · *miring* · daftar dengan - atau 1.';

    this.#saveStatus = document.createElement('p');
    this.#saveStatus.className = 'day-panel-save-status';
    this.#saveStatus.setAttribute('role', 'status');
    this.#store.onPersistence?.((state) => {
      this.#saveStatus.textContent = state.ok
        ? 'Tersimpan otomatis'
        : 'Tidak dapat menyimpan di browser ini';
    });

    this.#deleteBtn = document.createElement('button');
    this.#deleteBtn.type = 'button';
    this.#deleteBtn.className = 'day-panel-delete';
    this.#deleteBtn.textContent = 'Hapus';
    this.#deleteBtn.addEventListener('click', () => this.#deleteCurrentDay());

    const actions = document.createElement('div');
    actions.className = 'day-panel-actions';

    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'day-panel-done';
    closeBtn.textContent = 'Selesai';
    closeBtn.addEventListener('click', () => this.close());

    actions.append(this.#deleteBtn, closeBtn);
    dialog.append(
      this.#title,
      this.#moodRow,
      this.#preview,
      this.#textarea,
      formatHint,
      this.#saveStatus,
      actions
    );

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
