import { parseDateInput } from '../core/date-utils.js';

// Command-palette style box for jumping to a date. Owns its own DOM; the
// caller only receives a parsed Date via onSubmit.
//
// Uses <dialog>.showModal() so Escape, the focus trap, and focus restoration
// come from the platform rather than from bespoke bookkeeping.
export class DateJumper {
  #dialog;
  #input;
  #onSubmit = null;
  #onReject = null;
  #accepted = null;

  constructor() {
    this.#build();
  }

  onSubmit(callback) { this.#onSubmit = callback; return this; }

  // Called with the raw text when it cannot be parsed, so the host can toast.
  onReject(callback) { this.#onReject = callback; return this; }

  isOpen() {
    return this.#dialog.open;
  }

  open() {
    this.#accepted = null;
    this.#input.value = '';
    this.#dialog.showModal();
    this.#input.focus();
  }

  close() {
    if (this.#dialog.open) this.#dialog.close();
  }

  #submit() {
    const date = parseDateInput(this.#input.value);
    if (!date) {
      this.#onReject?.(this.#input.value);
      this.#input.focus();
      return;
    }
    // Close first so the platform restores focus, then let the host move it
    // onto the target day — otherwise the restore would steal it back.
    this.#accepted = date;
    this.close();
  }

  #build() {
    const dialog = document.createElement('dialog');
    dialog.className = 'date-jumper';
    dialog.setAttribute('aria-label', 'Lompat ke tanggal');

    const input = document.createElement('input');
    input.type = 'text';
    input.setAttribute('aria-label', 'Tanggal atau tahun');
    input.setAttribute('autocomplete', 'off');
    input.setAttribute('spellcheck', 'false');
    input.placeholder = '2026-05-12 · 12/05/2026 · 2026';

    const hint = document.createElement('div');
    hint.className = 'date-jumper-hint';
    hint.textContent = 'ENTER jump · ESC close';

    dialog.append(input, hint);
    document.body.append(dialog);

    // Scoped so the app's single-letter shortcuts never fire while typing.
    dialog.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key !== 'Enter') return;
      e.preventDefault();
      this.#submit();
    });

    dialog.addEventListener('click', (e) => {
      if (e.target === dialog) this.close();
    });

    dialog.addEventListener('close', () => {
      const date = this.#accepted;
      this.#accepted = null;
      if (date) this.#onSubmit?.(date);
    });

    this.#dialog = dialog;
    this.#input = input;
  }
}
