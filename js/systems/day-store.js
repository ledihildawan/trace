const STORAGE_KEY = 'trace-days';
const WRITE_DEBOUNCE_MS = 350;

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
  #writeTimer = null;

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
    this.#byYear.clear();
    for (const key of this.#data.keys()) this.#index(key);
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
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...this.#data]));
    } catch {
      /* quota exceeded or storage unavailable — keep in-memory */
    }
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
    if (this.#writeTimer === null) return;
    clearTimeout(this.#writeTimer);
    this.#writeTimer = null;
    this.#writeNow();
  }

  static keyOf(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  // Inverse of keyOf. Returns null for anything that is not YYYY-MM-DD.
  static dateOf(key) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
    if (!m) return null;
    return { year: +m[1], month: +m[2] - 1, date: +m[3] };
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
    else {
      this.flush();
      this.#writeNow();
    }
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
      this.flush();
      this.#writeNow();
      this.#emit(); // no key: listeners must refresh everything
    }
    return changed;
  }

  // Nearest recorded day strictly before (-1) or after (+1) `fromKey`.
  // ISO keys sort chronologically, so plain string comparison is enough.
  adjacentKey(fromKey, direction) {
    let best = null;
    for (const key of this.#data.keys()) {
      if (direction > 0 ? key <= fromKey : key >= fromKey) continue;
      if (best === null || (direction > 0 ? key < best : key > best)) best = key;
    }
    return best;
  }

  clear(key) {
    if (!this.#data.delete(key)) return;
    this.#unindex(key);
    this.flush();
    this.#writeNow();
    this.#emit(key);
  }

  // Listeners receive the changed key so they can update just that day
  // instead of rescanning every rendered cell. Omitted key = bulk change.
  onChange(cb) {
    this.#listeners.add(cb);
    return () => this.#listeners.delete(cb);
  }

  #emit(key) {
    this.#listeners.forEach((cb) => cb(key));
  }
}
