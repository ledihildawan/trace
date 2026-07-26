import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ARCHIVE_VERSION,
  archiveFilename,
  parseArchive,
  serializeArchive,
} from '../js/systems/day-archive.js';

const ENTRIES = [
  ['2026-01-01', { note: 'mulai' }],
  ['2026-07-27', { mood: 'good', note: 'rapat' }],
];

test('an exported archive carries its format and version', () => {
  const out = serializeArchive(ENTRIES, new Date(Date.UTC(2026, 6, 27)));
  assert.equal(out.format, 'trace-days');
  assert.equal(out.version, ARCHIVE_VERSION);
  assert.equal(out.exportedAt, '2026-07-27T00:00:00.000Z');
  assert.deepEqual(out.days['2026-07-27'], { mood: 'good', note: 'rapat' });
});

test('export and import round-trip without loss', () => {
  const json = JSON.stringify(serializeArchive(ENTRIES));
  const result = parseArchive(json);
  assert.equal(result.error, undefined);
  assert.deepEqual(result.entries.sort(), ENTRIES.sort());
});

test('a bare day map imports too, so a hand-edited file still works', () => {
  const result = parseArchive('{"2026-07-27":{"mood":"good"}}');
  assert.deepEqual(result.entries, [['2026-07-27', { mood: 'good' }]]);
});

test('malformed input is reported, never thrown', () => {
  for (const bad of ['', 'not json', '[]', 'null', '42', '"text"']) {
    const result = parseArchive(bad);
    assert.ok(result.error, `expected an error for ${JSON.stringify(bad)}`);
    assert.equal(result.entries, undefined);
  }
});

test('a foreign format or a future version is refused', () => {
  assert.match(parseArchive('{"format":"other","days":{}}').error, /unknown format/);
  const future = JSON.stringify({ format: 'trace-days', version: ARCHIVE_VERSION + 1, days: {} });
  assert.match(parseArchive(future).error, /newer than this app/);
});

test('junk keys and empty entries are skipped, not imported', () => {
  const result = parseArchive(JSON.stringify({
    '2026-07-27': { note: 'keep' },
    'not-a-date': { note: 'drop' },
    '2026-13-99': { note: 'drop' },   // matches the shape but is not a real day
    '2026-02-31': { note: 'drop' },   // shape-valid, calendar-invalid
    '2026-01-02': { note: '   ' },      // blank after trimming
    '2026-01-03': null,
    '2026-01-04': 'wrong type',
  }));
  assert.deepEqual(result.entries, [['2026-07-27', { note: 'keep' }]]);
  assert.equal(result.skipped, 6);
});

test('notes are trimmed and empty fields dropped on import', () => {
  const result = parseArchive('{"2026-07-27":{"note":"  hi  ","mood":""}}');
  assert.deepEqual(result.entries, [['2026-07-27', { note: 'hi' }]]);
  assert.ok(!('mood' in result.entries[0][1]), 'empty mood must not be stored');
});

test('an archive with nothing usable is an error, not a silent no-op', () => {
  assert.match(parseArchive('{"days":{}}').error, /no usable day entries/);
  assert.match(parseArchive('{"nope":{"note":"x"}}').error, /no usable day entries/);
});

test('the filename carries the export date', () => {
  assert.equal(archiveFilename(new Date(2026, 0, 5)), 'trace-days-2026-01-05.json');
  assert.equal(archiveFilename(new Date(2026, 11, 31)), 'trace-days-2026-12-31.json');
});
