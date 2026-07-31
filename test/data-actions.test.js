import test from 'node:test';
import assert from 'node:assert/strict';
import { installDom } from './helpers/dom.js';

installDom();

const { validateArchive, summarizeMerge, DataActions } = await import('../js/ui/data-actions.js');

test('invalid archive is rejected before mutation', () => {
  assert.throws(
    () => validateArchive({ version: 1, days: [['not-a-date', { note: 'x' }]] }),
    { name: 'ArchiveError' }
  );
});

test('merge summary distinguishes changed and preserved days', () => {
  const summary = summarizeMerge(
    [['2026-07-30', { note: 'lama', mood: '' }]],
    [
      ['2026-07-30', { note: 'lama', mood: '' }],
      ['2026-07-31', { note: 'baru', mood: 'good' }],
    ]
  );
  assert.deepEqual(
    { imported: summary.imported, preserved: summary.preserved, skipped: summary.skipped },
    { imported: 1, preserved: 1, skipped: 0 }
  );
});
