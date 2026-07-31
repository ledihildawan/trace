import { DayStore, moodColor } from '../systems/day-store.js';
import { buildSnippet, searchDays } from '../systems/day-search.js';
import { formatFullDate } from '../core/date-utils.js';
import { UI_COPY } from '../core/ui-copy.js';
import { OdysseyConfig } from '../config/odyssey-config.js';

// Command box for finding a day again. Notes were write-only until this
// existed: you could record a day but never get back to it.
export class NoteSearch {
  #store;
  #dialog;
  #input;
  #list;
  #status;
  #results = [];
  #active = -1;
  #onSelect = null;
  #chosen = null;

  constructor(store) {
    this.#store = store;
    this.#build();
  }

  onSelect(callback) { this.#onSelect = callback; return this; }

  isOpen() {
    return this.#dialog.open;
  }

  open() {
    this.#chosen = null;
    this.#input.value = '';
    this.#render('');
    this.#dialog.showModal();
    this.#input.focus();
  }

  close() {
    if (this.#dialog.open) this.#dialog.close();
  }

  #render(query) {
    this.#results = searchDays(this.#store.entries(), query);
    this.#active = this.#results.length ? 0 : -1;
    this.#list.replaceChildren();

    if (!query.trim()) {
      this.#status.textContent = UI_COPY.search.prompt;
      return;
    }
    if (!this.#results.length) {
      this.#status.textContent = UI_COPY.search.noResults;
      return;
    }

    this.#status.textContent =
      `${this.#results.length} hari · ↑↓ pilih · ENTER buka`;
    this.#results.forEach((result, i) => this.#list.append(this.#row(result, i, query)));
    this.#syncActive();
  }

  #row(result, index, query) {
    const parts = DayStore.dateOf(result.key);
    const row = document.createElement('li');
    row.className = 'note-hit';
    row.id = `note-hit-${index}`;
    row.setAttribute('role', 'option');
    row.dataset.index = String(index);

    const dot = document.createElement('span');
    dot.className = 'note-hit-mood';
    dot.style.background = moodColor(result.mood) || 'transparent';
    dot.setAttribute('aria-hidden', 'true');

    const when = document.createElement('span');
    when.className = 'note-hit-date';
    when.textContent = parts
      ? formatFullDate(new Date(parts.year, parts.month, parts.date))
      : result.key;

    const snippet = buildSnippet(result.note, result.index, query.trim().length);
    const body = document.createElement('span');
    body.className = 'note-hit-text';
    if (snippet.from >= 0) {
      // Built from text nodes rather than innerHTML: notes are user input.
      body.append(
        document.createTextNode(snippet.text.slice(0, snippet.from)),
        Object.assign(document.createElement('mark'), {
          textContent: snippet.text.slice(snippet.from, snippet.to),
        }),
        document.createTextNode(snippet.text.slice(snippet.to))
      );
    } else {
      body.textContent = snippet.text;
    }

    row.append(dot, when, body);
    row.addEventListener('click', () => this.#choose(index));
    return row;
  }

  #move(delta) {
    if (!this.#results.length) return;
    const count = this.#results.length;
    this.#active = (this.#active + delta + count) % count;
    this.#syncActive();
  }

  #syncActive() {
    [...this.#list.children].forEach((row, i) => {
      const isActive = i === this.#active;
      row.classList.toggle(OdysseyConfig.classes.isActive, isActive);
      row.setAttribute('aria-selected', String(isActive));
      if (isActive) {
        row.scrollIntoView({ block: 'nearest' });
        this.#input.setAttribute('aria-activedescendant', row.id);
      }
    });
  }

  #choose(index) {
    const result = this.#results[index];
    if (!result) return;
    const parts = DayStore.dateOf(result.key);
    if (!parts) return;
    // Close first so the platform restores focus, then let the host move it
    // onto the day — the same ordering DateJumper uses.
    this.#chosen = new Date(parts.year, parts.month, parts.date);
    this.close();
  }

  #build() {
    const dialog = document.createElement('dialog');
    dialog.className = 'note-search';
    dialog.setAttribute('aria-label', UI_COPY.search.label);

    const input = document.createElement('input');
    input.type = 'search';
    input.className = 'note-search-input';
    input.placeholder = `${UI_COPY.search.label}…`;
    input.setAttribute('aria-label', UI_COPY.search.label);
    input.setAttribute('autocomplete', 'off');
    input.setAttribute('spellcheck', 'false');
    input.setAttribute('role', 'combobox');
    input.setAttribute('aria-expanded', 'true');
    input.setAttribute('aria-controls', 'note-search-results');

    const list = document.createElement('ul');
    list.className = 'note-search-results';
    list.id = 'note-search-results';
    list.setAttribute('role', 'listbox');
    list.setAttribute('aria-label', 'Hasil pencarian');

    const status = document.createElement('div');
    status.className = 'note-search-status';
    status.setAttribute('aria-live', 'polite');

    dialog.append(input, list, status);
    document.body.append(dialog);

    input.addEventListener('input', () => this.#render(input.value));

    dialog.addEventListener('keydown', (e) => {
      e.stopPropagation(); // never let single-letter shortcuts fire while typing
      if (e.key === 'ArrowDown') { e.preventDefault(); this.#move(1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); this.#move(-1); }
      else if (e.key === 'Enter') { e.preventDefault(); this.#choose(this.#active); }
    });

    dialog.addEventListener('click', (e) => {
      if (e.target === dialog) this.close();
    });

    dialog.addEventListener('close', () => {
      const date = this.#chosen;
      this.#chosen = null;
      if (date) this.#onSelect?.(date);
    });

    this.#dialog = dialog;
    this.#input = input;
    this.#list = list;
    this.#status = status;
  }
}
