import test from 'node:test';
import assert from 'node:assert/strict';

// DayStore touches localStorage and registers page-lifecycle listeners at
// construction, so stub those before the module is evaluated.
const backing = new Map();
globalThis.localStorage = {
  getItem: (k) => (backing.has(k) ? backing.get(k) : null),
  setItem: (k, v) => backing.set(k, String(v)),
  removeItem: (k) => backing.delete(k),
};
globalThis.addEventListener = () => {};
globalThis.document = { visibilityState: 'visible' };

const { DayStore, MOODS, moodColor } = await import('../js/systems/day-store.js');

const KEY = 'trace-days';
const fresh = () => {
  backing.clear();
  return new DayStore();
};
const stored = () => JSON.parse(backing.get(KEY) ?? '[]');

test('keyOf and dateOf round-trip a date', () => {
  const key = DayStore.keyOf(new Date(2026, 6, 27));
  assert.equal(key, '2026-07-27');
  assert.deepEqual(DayStore.dateOf(key), { year: 2026, month: 6, date: 27 });
  assert.equal(DayStore.dateOf('nonsense'), null);
  assert.equal(DayStore.dateOf('2026-7-27'), null, 'requires zero padding');
});

test('keyOf pads single-digit months and days', () => {
  assert.equal(DayStore.keyOf(new Date(2026, 0, 5)), '2026-01-05');
});

test('a mood is written through immediately', () => {
  const s = fresh();
  s.setMood('2026-07-27', 'good');
  assert.deepEqual(stored(), [['2026-07-27', { mood: 'good' }]]);
  assert.equal(s.size, 1);
});

test('an unknown mood is rejected rather than stored', () => {
  const s = fresh();
  s.setMood('2026-07-27', 'ecstatic');
  assert.equal(s.get('2026-07-27'), null, 'entry pruned: no note and no valid mood');
});

test('notes are trimmed, and whitespace-only notes prune the entry', () => {
  const s = fresh();
  s.setNote('2026-07-27', '  hello  ');
  s.flush();
  assert.equal(s.get('2026-07-27').note, 'hello');

  s.setNote('2026-07-27', '   ');
  s.flush();
  assert.equal(s.get('2026-07-27'), null);
  assert.equal(s.size, 0);
});

test('note writes are batched until flush, so typing does not thrash storage', () => {
  const s = fresh();
  s.setNote('2026-07-27', 'a');
  s.setNote('2026-07-27', 'ab');
  s.setNote('2026-07-27', 'abc');
  assert.equal(backing.get(KEY), undefined, 'nothing written yet');

  s.flush();
  assert.deepEqual(stored(), [['2026-07-27', { note: 'abc' }]]);
});

test('clearing a day removes it and persists at once', () => {
  const s = fresh();
  s.setMood('2026-07-27', 'good');
  s.clear('2026-07-27');
  assert.equal(s.size, 0);
  assert.deepEqual(stored(), []);
});

test('listeners receive the key that changed and can unsubscribe', () => {
  const s = fresh();
  const seen = [];
  const off = s.onChange((key) => seen.push(key));
  s.setMood('2026-07-27', 'good');
  s.setNote('2026-01-01', 'x');
  assert.deepEqual(seen, ['2026-07-27', '2026-01-01']);

  off();
  s.setMood('2026-02-02', 'low');
  assert.equal(seen.length, 2, 'no further notifications after unsubscribe');
  s.flush();
});

test('a mood and a note coexist on the same day', () => {
  const s = fresh();
  s.setMood('2026-07-27', 'okay');
  s.setNote('2026-07-27', 'ada rapat');
  s.flush();
  assert.deepEqual(s.get('2026-07-27'), { mood: 'okay', note: 'ada rapat' });
});

test('corrupt storage is ignored instead of crashing the app', () => {
  backing.clear();
  backing.set(KEY, '{not json');
  assert.equal(new DayStore().size, 0);

  backing.set(KEY, '{"shape":"wrong"}');
  assert.equal(new DayStore().size, 0, 'a non-array payload is discarded');
});

test('existing data is reloaded from storage', () => {
  backing.clear();
  backing.set(KEY, JSON.stringify([['2026-07-27', { mood: 'good', note: 'hi' }]]));
  const s = new DayStore();
  assert.equal(s.size, 1);
  assert.equal(s.has('2026-07-27'), true);
  assert.deepEqual(s.get('2026-07-27'), { mood: 'good', note: 'hi' });
});

test('keysForYear groups entries by their year', () => {
  const s = fresh();
  s.setMood('2026-07-27', 'good');
  s.setMood('2026-01-01', 'okay');
  s.setMood('2025-12-31', 'low');

  assert.deepEqual([...s.keysForYear(2026)].sort(), ['2026-01-01', '2026-07-27']);
  assert.deepEqual([...s.keysForYear(2025)], ['2025-12-31']);
});

test('keysForYear returns an empty set for years with no data', () => {
  const s = fresh();
  const keys = s.keysForYear(1999);
  assert.equal(keys.size, 0);
  assert.doesNotThrow(() => [...keys], 'must be iterable, never null');
});

test('the year index drops entries as they are pruned or cleared', () => {
  const s = fresh();
  s.setMood('2026-07-27', 'good');
  s.setNote('2026-07-27', 'hi');
  s.flush();
  assert.equal(s.keysForYear(2026).size, 1, 'one key even with both fields set');

  s.clear('2026-07-27');
  assert.equal(s.keysForYear(2026).size, 0, 'cleared key left the index');

  s.setNote('2026-03-03', 'x');
  s.flush();
  assert.equal(s.keysForYear(2026).size, 1);
  s.setNote('2026-03-03', '   ');   // prunes the entry
  s.flush();
  assert.equal(s.keysForYear(2026).size, 0, 'pruned key left the index');
});

test('the year index is rebuilt when loading from storage', () => {
  backing.clear();
  backing.set(KEY, JSON.stringify([
    ['2026-07-27', { mood: 'good' }],
    ['2024-02-29', { note: 'kabisat' }],
  ]));
  const s = new DayStore();
  assert.deepEqual([...s.keysForYear(2026)], ['2026-07-27']);
  assert.deepEqual([...s.keysForYear(2024)], ['2024-02-29']);
});

test('adjacentKey walks to the nearest recorded day in each direction', () => {
  const s = fresh();
  ['2025-12-01', '2026-03-11', '2026-07-27'].forEach((k) => s.setMood(k, 'good'));

  assert.equal(s.adjacentKey('2026-03-11', 1), '2026-07-27');
  assert.equal(s.adjacentKey('2026-03-11', -1), '2025-12-01');
  assert.equal(s.adjacentKey('2026-01-01', 1), '2026-03-11', 'skips to the next recorded day');
  assert.equal(s.adjacentKey('2026-12-31', -1), '2026-07-27');
});

test('adjacentKey is strict, so it never returns the day you are on', () => {
  const s = fresh();
  s.setMood('2026-07-27', 'good');
  assert.equal(s.adjacentKey('2026-07-27', 1), null);
  assert.equal(s.adjacentKey('2026-07-27', -1), null);
});

test('adjacentKey returns null at the ends and on an empty log', () => {
  const empty = fresh();
  assert.equal(empty.adjacentKey('2026-07-27', 1), null);

  const s = fresh();
  s.setMood('2026-07-27', 'good');
  assert.equal(s.adjacentKey('2030-01-01', 1), null, 'nothing later');
  assert.equal(s.adjacentKey('2000-01-01', -1), null, 'nothing earlier');
});

test('moodColor resolves known moods and rejects unknown ones', () => {
  assert.equal(moodColor('great'), MOODS[0].color);
  assert.equal(moodColor('nope'), null);
  assert.equal(moodColor(undefined), null);
});

test('every mood sits at the same perceptual lightness', () => {
  // The point of the OKLCH palette: no dot reads brighter or heavier than
  // its neighbours. Locking this in stops a future hex tweak from undoing it.
  const lightness = MOODS.map((m) => {
    const match = /^oklch\(\s*([\d.]+)%/.exec(m.color);
    assert.ok(match, `${m.key} should be expressed in oklch(), got ${m.color}`);
    return Number(match[1]);
  });
  assert.equal(new Set(lightness).size, 1, `expected one shared lightness, got ${lightness}`);
});

test('mood keys and labels are unique', () => {
  assert.equal(new Set(MOODS.map((m) => m.key)).size, MOODS.length);
  assert.equal(new Set(MOODS.map((m) => m.label)).size, MOODS.length);
});
