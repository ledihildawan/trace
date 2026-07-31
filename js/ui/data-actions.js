import { DayStore } from '../systems/day-store.js';
import { parseArchive, downloadArchive, pickArchiveFile } from '../systems/day-archive.js';

const ARCHIVE_VERSION = 1;

export class ArchiveError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ArchiveError';
  }
}

export function validateArchive(value) {
  if (!value || typeof value !== 'object') {
    throw new ArchiveError('arsip tidak valid');
  }
  if (value.format && value.format !== 'trace-days') {
    throw new ArchiveError(`format tidak dikenal "${value.format}"`);
  }
  if (value.version && Number(value.version) > ARCHIVE_VERSION) {
    throw new ArchiveError('versi arsip terlalu baru');
  }
  const days = value.days && typeof value.days === 'object' ? value.days : value;
  const entries = [];
  let skipped = 0;
  for (const [key, val] of Object.entries(days)) {
    const parts = DayStore.dateOf(key);
    if (!parts) { skipped++; continue; }
    if (!val || typeof val !== 'object') { skipped++; continue; }
    const note = typeof val.note === 'string' ? val.note.trim() : '';
    const mood = typeof val.mood === 'string' ? val.mood.trim() : '';
    if (!note && !mood) { skipped++; continue; }
    const entry = {};
    if (note) entry.note = note;
    if (mood && isValidMood(mood)) entry.mood = mood;
    entries.push([key, entry]);
  }
  if (!entries.length) {
    throw new ArchiveError('tidak ada entri yang valid');
  }
  return entries;
}

function isValidMood(mood) {
  return ['great', 'good', 'okay', 'low', 'rough'].includes(mood);
}

export function summarizeMerge(existingEntries, incomingEntries) {
  const existingMap = new Map(existingEntries);
  let imported = 0;
  let preserved = 0;
  let skipped = 0;
  const entries = [];

  for (const [key, entry] of incomingEntries) {
    const existing = existingMap.get(key);
    if (existing && existing.note === entry.note && existing.mood === entry.mood) {
      preserved++;
      entries.push([key, existing]);
    } else {
      imported++;
      entries.push([key, entry]);
    }
  }

  return { imported, preserved, skipped, entries };
}

export class DataActions {
  #store;
  #onUpdate;

  constructor(store, { onUpdate } = {}) {
    this.#store = store;
    this.#onUpdate = onUpdate;
  }

  async open() {
    const result = await pickArchiveFile();
    if (!result) return;

    let importResult;
    if (result.error) {
      importResult = { error: result.error };
    } else {
      try {
        const normalizedEntries = validateArchive(result);
        const existingEntries = this.#store.entries();
        const summary = summarizeMerge(existingEntries, normalizedEntries);
        this.#store.merge(summary.entries);
        importResult = {
          imported: summary.imported,
          preserved: summary.preserved,
          skipped: summary.skipped,
        };
      } catch (err) {
        importResult = { error: err.message };
      }
    }
    this.#onUpdate?.(importResult);
  }

  export() {
    downloadArchive(this.#store.entries());
  }
}
