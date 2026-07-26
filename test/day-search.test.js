import test from 'node:test';
import assert from 'node:assert/strict';

import { buildSnippet, normalize, searchDays } from '../js/systems/day-search.js';
import { MOODS } from '../js/systems/day-store.js';

const ENTRIES = [
  ['2026-01-05', { note: 'Rapat dengan tim desain' }],
  ['2026-03-11', { note: 'Kerja lembur, capek sekali', mood: 'low' }],
  ['2026-07-27', { note: 'Rapat besar hari ini', mood: 'good' }],
  ['2025-12-01', { note: 'Libur panjang' }],
  ['2026-09-09', { mood: 'great' }], // mood only, no note
];

const keys = (results) => results.map((r) => r.key);

test('normalize folds case, accents and repeated whitespace', () => {
  assert.equal(normalize('  Kèrja   Lembur '), 'kerja lembur');
  assert.equal(normalize('RAPAT'), 'rapat');
  assert.equal(normalize(null), '');
  assert.equal(normalize(undefined), '');
});

test('an empty query returns nothing rather than everything', () => {
  assert.deepEqual(searchDays(ENTRIES, ''), []);
  assert.deepEqual(searchDays(ENTRIES, '   '), []);
});

test('search finds every day whose note contains the term', () => {
  const found = searchDays(ENTRIES, 'rapat');
  assert.deepEqual(keys(found).sort(), ['2026-01-05', '2026-07-27']);
});

test('search ignores case and accents', () => {
  assert.deepEqual(keys(searchDays(ENTRIES, 'RAPAT')).sort(), ['2026-01-05', '2026-07-27']);
  assert.deepEqual(keys(searchDays(ENTRIES, 'kèrja')), ['2026-03-11']);
});

test('a note starting with the term outranks one matching mid-word', () => {
  const entries = [
    ['2026-01-01', { note: 'sesuatu tentang kopi' }],   // mid-string
    ['2026-01-02', { note: 'kopi pagi' }],              // starts with
  ];
  assert.equal(searchDays(entries, 'kopi')[0].key, '2026-01-02');
});

test('a word-boundary match outranks one inside a word', () => {
  const entries = [
    ['2026-01-01', { note: 'berkopi' }],       // inside a word
    ['2026-01-02', { note: 'minum kopi' }],    // starts a word
  ];
  assert.equal(searchDays(entries, 'kopi')[0].key, '2026-01-02');
});

test('equally ranked days come back newest first', () => {
  const found = searchDays(ENTRIES, 'rapat');
  assert.equal(found[0].key, '2026-07-27', 'both start with "Rapat", newer wins');
});

test('mood labels are searchable, and rank below note matches', () => {
  const byMood = searchDays(ENTRIES, MOODS.find((m) => m.key === 'great').label);
  assert.deepEqual(keys(byMood), ['2026-09-09']);
  assert.equal(byMood[0].index, -1, 'no note match position');

  const mixed = searchDays(
    [['2026-01-01', { mood: 'good' }], ['2026-01-02', { note: 'Baik sekali' }]],
    'baik'
  );
  assert.equal(mixed[0].key, '2026-01-02', 'note match beats mood-only match');
});

test('a term matching nothing returns an empty list', () => {
  assert.deepEqual(searchDays(ENTRIES, 'zzzz'), []);
});

test('results are capped by the limit option', () => {
  const many = Array.from({ length: 50 }, (_, i) => [
    `2026-01-${String(i + 1).padStart(2, '0')}`,
    { note: 'sama' },
  ]);
  assert.equal(searchDays(many, 'sama').length, 30, 'default limit');
  assert.equal(searchDays(many, 'sama', { limit: 5 }).length, 5);
});

test('entries without a note or mood are simply skipped', () => {
  const found = searchDays([['2026-01-01', {}], ['2026-01-02', null]], 'apa');
  assert.deepEqual(found, []);
});

test('a snippet centres on the match and marks its position', () => {
  const note = 'Bagian awal yang panjang sekali, lalu kata kunci, lalu ekor panjang juga';
  const index = normalize(note).indexOf('kunci');
  const snippet = buildSnippet(note, index, 5, 10);
  assert.ok(snippet.text.includes('kunci'));
  assert.equal(snippet.text.slice(snippet.from, snippet.to), 'kunci');
  assert.ok(snippet.text.startsWith('…'), 'cut at the front is marked');
  assert.ok(snippet.text.endsWith('…'), 'cut at the end is marked');
});

test('a short note is shown whole, with no ellipsis', () => {
  const snippet = buildSnippet('Libur', 0, 5, 32);
  assert.equal(snippet.text, 'Libur');
  assert.equal(snippet.from, 0);
  assert.equal(snippet.to, 5);
});

test('a mood-only hit yields a snippet with no highlight range', () => {
  const snippet = buildSnippet('', -1, 4);
  assert.equal(snippet.from, -1);
  assert.equal(snippet.to, -1);
});
