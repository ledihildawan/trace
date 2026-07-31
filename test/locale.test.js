import test from 'node:test';
import assert from 'node:assert/strict';

import { TemporalLabels, buildTemporalLabels } from '../js/core/locale.js';
import { OdysseyConfig } from '../js/config/odyssey-config.js';
import { UI_COPY, formatYearTravel } from '../js/core/ui-copy.js';

test('application chrome uses Indonesian copy', () => {
  assert.equal(UI_COPY.dock.today, 'Hari ini');
  assert.equal(UI_COPY.dock.search, 'Cari');
  assert.equal(UI_COPY.dock.menu, 'Menu');
  assert.equal(UI_COPY.loading, 'Menyelaraskan perjalanan waktu…');
});

test('nested application copy groups are immutable', () => {
  const groups = [
    [UI_COPY.dock, 'today', 'Hari ini'],
    [UI_COPY.nav, 'previousYear', 'Tahun sebelumnya'],
    [UI_COPY.search, 'label', 'Cari catatan'],
  ];

  for (const [group, key, value] of groups) {
    assert.equal(Object.isFrozen(group), true);
    assert.throws(() => { group[key] = 'Berubah'; }, TypeError);
    assert.equal(group[key], value);
  }
});

test('year travel feedback names the destination', () => {
  assert.equal(formatYearTravel(1, 2027), 'Menuju tahun 2027');
  assert.equal(formatYearTravel(-10, 2016), 'Mundur 10 tahun · 2016');
});

test('the configured locale resolves to complete label sets', () => {
  assert.equal(TemporalLabels.locale, OdysseyConfig.temporal.locale);
  assert.equal(TemporalLabels.monthsShort.length, 12);
  assert.equal(TemporalLabels.monthsFull.length, 12);
  assert.equal(TemporalLabels.daysShort.length, 7);
  assert.equal(TemporalLabels.daysFull.length, 7);
});

test('no label is empty or duplicated', () => {
  for (const key of ['monthsShort', 'monthsFull', 'daysShort', 'daysFull']) {
    const labels = TemporalLabels[key];
    assert.ok(labels.every((l) => typeof l === 'string' && l.trim()), `${key} has a blank entry`);
    assert.equal(new Set(labels).size, labels.length, `${key} has duplicates`);
  }
});

test('weekday order starts at Sunday to match Date#getDay', () => {
  // The renderer indexes these arrays directly with getDay(), so a shifted
  // anchor would mislabel every single cell.
  assert.equal(TemporalLabels.daysFull[0], 'Minggu');
  assert.equal(TemporalLabels.daysFull[1], 'Senin');
  assert.equal(TemporalLabels.daysFull[6], 'Sabtu');

  const sunday = new Date(2026, 6, 26);
  assert.equal(sunday.getDay(), 0);
  assert.equal(TemporalLabels.daysFull[sunday.getDay()], 'Minggu');
});

test('month order starts at January', () => {
  assert.equal(TemporalLabels.monthsFull[0], 'Januari');
  assert.equal(TemporalLabels.monthsFull[6], 'Juli');
  assert.equal(TemporalLabels.monthsFull[11], 'Desember');
});

test('labels are Indonesian, not an ICU fallback to English', () => {
  // A platform built with small-icu silently answers en-US for id-ID. That
  // would ship an English calendar, so fail loudly instead.
  assert.equal(TemporalLabels.monthsFull[0], 'Januari', 'expected Indonesian month data');
  assert.notEqual(TemporalLabels.daysFull[0], 'Sunday', 'ICU fell back to English');
});

test('a different locale produces different labels', () => {
  const en = buildTemporalLabels('en-US');
  assert.equal(en.daysFull[0], 'Sunday');
  assert.equal(en.monthsFull[0], 'January');
  assert.notDeepEqual(en.daysFull, TemporalLabels.daysFull);
});

test('short labels are not longer than their full counterparts', () => {
  TemporalLabels.monthsShort.forEach((short, i) => {
    assert.ok(short.length <= TemporalLabels.monthsFull[i].length);
  });
});
