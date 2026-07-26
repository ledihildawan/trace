import { MOODS } from './day-store.js';

// Full-text search over the day log. Pure: it takes the store's entries and a
// query, and returns ranked matches. Nothing here touches the DOM, so the
// ranking rules can be pinned down by tests.

const MOOD_LABEL = new Map(MOODS.map((m) => [m.key, m.label]));

// Case- and accent-insensitive, so "sakit" finds "Sakit" and "kèrja" finds
// "kerja". Whitespace is collapsed so a stray double space still matches.
export function normalize(text) {
  return String(text ?? '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

const SCORE = {
  startsWith: 4,
  wordStart: 3,
  substring: 2,
  moodOnly: 1,
};

function scoreNote(haystack, needle) {
  const index = haystack.indexOf(needle);
  if (index === -1) return null;
  if (index === 0) return { score: SCORE.startsWith, index };
  const isWordStart = /\s/.test(haystack[index - 1]);
  return { score: isWordStart ? SCORE.wordStart : SCORE.substring, index };
}

// Ranked matches, best first; ties break toward the more recent day.
// Each result: { key, note, mood, score, index } where `index` is the match
// position in the normalized note, or -1 when only the mood matched.
export function searchDays(entries, query, { limit = 30 } = {}) {
  const needle = normalize(query);
  if (!needle) return [];

  const results = [];
  for (const [key, entry] of entries) {
    const note = entry?.note ?? '';
    const hit = scoreNote(normalize(note), needle);
    const moodLabel = MOOD_LABEL.get(entry?.mood) ?? '';
    const moodHit = moodLabel && normalize(moodLabel).includes(needle);

    if (!hit && !moodHit) continue;
    results.push({
      key,
      note,
      mood: entry?.mood ?? '',
      score: hit ? hit.score : SCORE.moodOnly,
      index: hit ? hit.index : -1,
    });
  }

  results.sort((a, b) => (b.score - a.score) || (a.key < b.key ? 1 : a.key > b.key ? -1 : 0));
  return results.slice(0, limit);
}

// A window of the note around the match, with ellipses where it was cut.
// Returns { text, from, to } — from/to locate the match inside `text` so the
// caller can highlight it without re-running the search.
export function buildSnippet(note, matchIndex, queryLength, radius = 32) {
  const text = String(note ?? '');
  if (matchIndex < 0) return { text: truncate(text, radius * 2), from: -1, to: -1 };

  const start = Math.max(0, matchIndex - radius);
  const end = Math.min(text.length, matchIndex + queryLength + radius);
  const head = start > 0 ? '…' : '';
  const tail = end < text.length ? '…' : '';
  return {
    text: head + text.slice(start, end) + tail,
    from: head.length + (matchIndex - start),
    to: head.length + (matchIndex - start) + queryLength,
  };
}

function truncate(text, max) {
  return text.length <= max ? text : `${text.slice(0, max)}…`;
}
