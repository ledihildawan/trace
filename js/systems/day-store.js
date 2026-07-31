const STORAGE_KEY = 'trace-days';
const WRITE_DEBOUNCE_MS = 350;
const UNDO_DEPTH = 50;

// Five-step mood scale, ordered best → worst.
//
// All five sit at the same OKLCH lightness (77%) so no dot reads as brighter
// or heavier than its neighbours — the old hex set spread across 71%–84%,
// which made "Biasa" jump out and "Buruk" recede. Hues are unchanged; chroma
// is each hue's own sRGB maximum, so nothing lost saturation to get there.
export const MOODS = [
  { key: 'great', label: 'Luar Biasa', color: 'oklch(77% 0.1576 163.22)' },
  { key: 'good', label: 'Baik', color: 'oklch(77% 0.1272 211.53)' },
  { key: 'okay', label: 'Biasa', color: 'oklch(77% 0.1501 84.43)' },
  { key: 'low', label: 'Kurang', color: 'oklch(77% 0.1504 55.93)' },
  { key: 'rough', label: 'Buruk', color: 'oklch(77% 0.1289 22.22)' },
];

const MOOD_BY_KEY = new Map(MOODS.map((m) => [m.key, m]));

export function moodColor(key) {
  return MOOD_BY_KEY.get(key)?.color ?? null;
}

// localStorage-backed map of "YYYY-MM-DD" -> { note, mood }.
// Entries with neither note nor mood are pruned to keep storage small.
const NO_KEYS = Object.freeze(new Set());

export class DayStore {
  #data = new Map();
  // Secondary index year -> keys. The grid marks one year at a time, and a
  // year block has ~400 cells while a year usually holds a handful of notes,
  // so this lets callers walk the data instead of scanning the DOM.
  #byYear = new Map();
  #listeners = new Set();
  #persistenceListeners = new Set();
  #lastPersistence = { ok: true };
  #writeTimer = null;
  // Structural edits only — deleting a day and picking a mood. Typing is not
  // recorded: the textarea has native undo, and one snapshot per keystroke
  // would bury the edits that are actually hard to redo by hand.
  #history = [];

  constructor() {
    this.#load();
    // Never lose an in-flight note edit when the tab goes away.
    addEventListener('pagehide', () => this.flush());
    addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') this.flush();
    });
  }

  #load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) this.#data = new Map(parsed);
    } catch {
      /* corrupt or unavailable — start empty */
    }
    this.#reindex();
  }

  #reindex() {
    const grouped = Map.groupBy(this.#data.keys(), (key) => DayStore.dateOf(key)?.year);
    this.#byYear = new Map(
      grouped.entries()
        .filter(([year]) => year !== undefined) // keys that are not real dates
        .map(([year, keys]) => [year, new Set(keys)])
    );
  }

  #index(key) {
    const parts = DayStore.dateOf(key);
    if (!parts) return;
    let keys = this.#byYear.get(parts.year);
    if (!keys) this.#byYear.set(parts.year, (keys = new Set()));
    keys.add(key);
  }

  #unindex(key) {
    const parts = DayStore.dateOf(key);
    if (!parts) return;
    const keys = this.#byYear.get(parts.year);
    if (!keys) return;
    keys.delete(key);
    if (keys.size === 0) this.#byYear.delete(parts.year);
  }

  // Every stored key falling in `year`. Empty (never null) when there are none.
  keysForYear(year) {
    return this.#byYear.get(year) ?? NO_KEYS;
  }

  #writeNow() {
    let state;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...this.#data]));
      state = { ok: true };
    } catch (error) {
      // Quota exceeded or storage unavailable — keep the in-memory change.
      state = { ok: false, error };
    }
    return this.#emitPersistence(state);
  }

  #persistNow() {
    return this.#writeTimer === null ? this.#writeNow() : this.flush();
  }

  // Typing a note fires on every keystroke; serialising the whole map that
  // often is pure waste, so batch the write and let flush() force it.
  #scheduleWrite() {
    if (this.#writeTimer !== null) return;
    this.#writeTimer = setTimeout(() => {
      this.#writeTimer = null;
      this.#writeNow();
    }, WRITE_DEBOUNCE_MS);
  }

  flush() {
    if (this.#writeTimer === null) return this.#lastPersistence;
    clearTimeout(this.#writeTimer);
    this.#writeTimer = null;
    return this.#writeNow();
  }

  static keyOf(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  // Inverse of keyOf. Returns null for anything that is not YYYY-MM-DD.
  static dateOf(key) {
    const { groups } = /^(?<year>\d{4})-(?<month>\d{2})-(?<day>\d{2})$/.exec(key) ?? {};
    if (!groups) return null;
    return { year: +groups.year, month: +groups.month - 1, date: +groups.day };
  }

  get size() {
    return this.#data.size;
  }

  get(key) {
    return this.#data.get(key) || null;
  }

  has(key) {
    return this.#data.has(key);
  }

  setNote(key, note) {
    const entry = { ...this.#data.get(key) };
    entry.note = note?.trim() ? note.trim() : '';
    this.#finalize(key, entry, true);
  }

  setMood(key, mood) {
    this.#remember(key);
    const entry = { ...this.#data.get(key) };
    entry.mood = MOOD_BY_KEY.has(mood) ? mood : '';
    this.#finalize(key, entry, false);
  }

  #finalize(key, entry, deferWrite) {
    if (!entry.note && !entry.mood) {
      this.#data.delete(key);
      this.#unindex(key);
    } else {
      this.#data.set(key, entry);
      this.#index(key);
    }
    if (deferWrite) this.#scheduleWrite();
    else this.#persistNow();
    this.#emit(key);
  }

  // Snapshot for export, oldest day first.
  entries() {
    return [...this.#data].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  }

  // Bulk import. Incoming days win on conflict; existing days that are not in
  // the archive are kept, so importing never silently destroys local work.
  // Returns how many days were added or changed.
  merge(entries) {
    let changed = 0;
    for (const [key, entry] of entries) {
      const before = this.#data.get(key);
      if (before && before.note === entry.note && before.mood === entry.mood) continue;
      this.#data.set(key, entry);
      this.#index(key);
      changed++;
    }
    if (changed) {
      this.#persistNow();
      this.#emit(); // no key: listeners must refresh everything
    }
    return changed;
  }

  // Nearest recorded day strictly before (-1) or after (+1) `fromKey`.
  // ISO keys sort chronologically, so plain string comparison is enough.
  adjacentKey(fromKey, direction) {
    const forward = direction > 0;
    // Lazy: filters as it walks, so nothing is materialised.
    const candidates = this.#data.keys()
      .filter((key) => (forward ? key > fromKey : key < fromKey));

    let best = null;
    for (const key of candidates) {
      if (best === null || (forward ? key < best : key > best)) best = key;
    }
    return best;
  }

  clear(key) {
    if (!this.#data.has(key)) return;
    this.#remember(key);
    this.#data.delete(key);
    this.#unindex(key);
    this.#persistNow();
    this.#emit(key);
  }

  // Snapshots a day before it is changed, so undo can put it back.
  #remember(key) {
    const before = this.#data.get(key);
    this.#history.push([key, before ? { ...before } : null]);
    if (this.#history.length > UNDO_DEPTH) this.#history.shift();
  }

  get canUndo() {
    return this.#history.length > 0;
  }

  // Restores the most recent structural edit. Returns the affected key, or
  // null when there is nothing left to undo.
  undo() {
    const step = this.#history.pop();
    if (!step) return null;
    const [key, before] = step;
    if (before) {
      this.#data.set(key, before);
      this.#index(key);
    } else {
      this.#data.delete(key);
      this.#unindex(key);
    }
    this.#persistNow();
    this.#emit(key);
    return key;
  }

  // Listeners receive the changed key so they can update just that day
  // instead of rescanning every rendered cell. Omitted key = bulk change.
  onChange(cb) {
    this.#listeners.add(cb);
    return () => this.#listeners.delete(cb);
  }

  // Listeners receive the result of each actual localStorage write.
  onPersistence(cb) {
    this.#persistenceListeners.add(cb);
    return () => this.#persistenceListeners.delete(cb);
  }

  #emit(key) {
    this.#listeners.forEach((cb) => cb(key));
  }

  #emitPersistence(state) {
    this.#lastPersistence = state;
    this.#persistenceListeners.forEach((cb) => {
      try {
        cb(state);
      } catch {
        // Observers must not turn a successful write into a failed mutation.
      }
    });
    return state;
  }
}
