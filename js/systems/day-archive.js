import { makeValidDate } from '../core/date-utils.js';

// Import/export for the day log. Everything the user writes lives only in
// localStorage, which one cleared cache erases for good — this is the way out.
//
// The parsing half is pure so it can be tested against hostile input; only
// the two helpers at the bottom touch the DOM.

export const ARCHIVE_VERSION = 1;

export function serializeArchive(entries, exportedAt = new Date()) {
  return {
    format: 'trace-days',
    version: ARCHIVE_VERSION,
    exportedAt: exportedAt.toISOString(),
    days: Object.fromEntries(entries),
  };
}

const DAY_KEY = /^(\d{4})-(\d{2})-(\d{2})$/;

// Shape alone is not enough: "2026-13-99" matches the pattern but names no
// real day, and such an entry could never be shown on the grid.
function isRealDayKey(key) {
  const m = DAY_KEY.exec(key);
  return m !== null && makeValidDate(+m[1], +m[2] - 1, +m[3]) !== null;
}

function cleanEntry(value) {
  if (!value || typeof value !== 'object') return null;
  const note = typeof value.note === 'string' ? value.note.trim() : '';
  const mood = typeof value.mood === 'string' ? value.mood.trim() : '';
  if (!note && !mood) return null;
  const entry = {};
  if (note) entry.note = note;
  if (mood) entry.mood = mood;
  return entry;
}

// Accepts the object written by serializeArchive, and also a bare
// { "2026-07-27": {...} } map so a hand-edited file still imports.
// Returns { entries, skipped } or { error } — never throws.
export function parseArchive(text) {
  let raw;
  try {
    raw = JSON.parse(text);
  } catch {
    return { error: 'not valid JSON' };
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { error: 'expected an object' };
  }
  if (raw.format && raw.format !== 'trace-days') {
    return { error: `unknown format "${raw.format}"` };
  }
  if (raw.version && Number(raw.version) > ARCHIVE_VERSION) {
    return { error: `version ${raw.version} is newer than this app understands` };
  }

  const days = raw.days && typeof raw.days === 'object' ? raw.days : raw;
  const entries = [];
  let skipped = 0;
  for (const [key, value] of Object.entries(days)) {
    const entry = isRealDayKey(key) ? cleanEntry(value) : null;
    if (entry) entries.push([key, entry]);
    else skipped++;
  }
  if (!entries.length) return { error: 'no usable day entries found' };
  return { entries, skipped };
}

export function archiveFilename(date = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return `trace-days-${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}.json`;
}

// ── DOM edges ──

export function downloadArchive(entries) {
  const blob = new Blob([JSON.stringify(serializeArchive(entries), null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = archiveFilename();
  link.click();
  URL.revokeObjectURL(url);
}

// Opens the file picker and resolves with the parse result, or null if the
// user dismissed it.
export function pickArchiveFile() {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.addEventListener('change', async () => {
      const file = input.files?.[0];
      resolve(file ? parseArchive(await file.text()) : null);
    });
    input.addEventListener('cancel', () => resolve(null));
    input.click();
  });
}
