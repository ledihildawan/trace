import test from 'node:test';
import assert from 'node:assert/strict';

import {
  addMonths,
  dayProgress,
  dayStamp,
  daysInMonth,
  daysInYear,
  endOfMonth,
  formatFullDate,
  isLeapYear,
  makeValidDate,
  parseDateInput,
  shiftDays,
  stampOf,
  startOfMonth,
} from '../js/core/date-utils.js';

const ymd = (d) => (d === null ? null : [d.getFullYear(), d.getMonth(), d.getDate()]);

test('leap years follow the Gregorian rule', () => {
  assert.equal(isLeapYear(2024), true);
  assert.equal(isLeapYear(2025), false);
  assert.equal(isLeapYear(1900), false, 'divisible by 100 but not 400');
  assert.equal(isLeapYear(2000), true, 'divisible by 400');
  assert.equal(daysInYear(2024), 366);
  assert.equal(daysInYear(2025), 365);
});

test('daysInMonth knows February in both kinds of year', () => {
  assert.equal(daysInMonth(2024, 1), 29);
  assert.equal(daysInMonth(2025, 1), 28);
  assert.equal(daysInMonth(2025, 0), 31);
  assert.equal(daysInMonth(2025, 3), 30);
});

test('shiftDays crosses month and year boundaries', () => {
  assert.deepEqual(ymd(shiftDays(new Date(2026, 0, 31), 1)), [2026, 1, 1]);
  assert.deepEqual(ymd(shiftDays(new Date(2026, 0, 1), -1)), [2025, 11, 31]);
  assert.deepEqual(ymd(shiftDays(new Date(2026, 6, 27), 7)), [2026, 7, 3]);
  assert.deepEqual(ymd(shiftDays(new Date(2024, 1, 28), 1)), [2024, 1, 29], 'leap day exists');
});

test('shiftDays does not mutate its argument', () => {
  const original = new Date(2026, 6, 27);
  shiftDays(original, 10);
  assert.deepEqual(ymd(original), [2026, 6, 27]);
});

test('startOfMonth and endOfMonth land on real boundaries', () => {
  assert.deepEqual(ymd(startOfMonth(new Date(2026, 6, 27))), [2026, 6, 1]);
  assert.deepEqual(ymd(endOfMonth(new Date(2026, 6, 27))), [2026, 6, 31]);
  assert.deepEqual(ymd(endOfMonth(new Date(2024, 1, 5))), [2024, 1, 29]);
  assert.deepEqual(ymd(endOfMonth(new Date(2025, 1, 5))), [2025, 1, 28]);
});

test('addMonths clamps the day instead of rolling over', () => {
  // The bug this replaced: new Date(y, m - 1, 31) from 31 March produced
  // 3 March, so PageUp appeared to do nothing.
  assert.deepEqual(ymd(addMonths(new Date(2025, 2, 31), -1)), [2025, 1, 28]);
  assert.deepEqual(ymd(addMonths(new Date(2024, 2, 31), -1)), [2024, 1, 29]);
  assert.deepEqual(ymd(addMonths(new Date(2026, 0, 31), 1)), [2026, 1, 28]);
  assert.deepEqual(ymd(addMonths(new Date(2026, 4, 31), 1)), [2026, 5, 30]);
});

test('addMonths keeps the day when the target month is long enough', () => {
  assert.deepEqual(ymd(addMonths(new Date(2026, 6, 15), 1)), [2026, 7, 15]);
  assert.deepEqual(ymd(addMonths(new Date(2026, 0, 15), -1)), [2025, 11, 15]);
});

test('makeValidDate rejects days that do not exist', () => {
  assert.deepEqual(ymd(makeValidDate(2026, 1, 31)), null, '31 February');
  assert.deepEqual(ymd(makeValidDate(2025, 1, 29)), null, '29 February in a common year');
  assert.deepEqual(ymd(makeValidDate(2024, 1, 29)), [2024, 1, 29], '29 February in a leap year');
  assert.deepEqual(ymd(makeValidDate(2026, 6, 27)), [2026, 6, 27]);
});

test('parseDateInput accepts a bare year', () => {
  assert.deepEqual(ymd(parseDateInput('2026')), [2026, 0, 1]);
  assert.deepEqual(ymd(parseDateInput('7')), [7, 0, 1]);
  assert.equal(parseDateInput('0'), null, 'year zero is out of range');
});

test('parseDateInput accepts ISO order with any separator', () => {
  for (const input of ['2026-05-12', '2026/05/12', '2026.5.12']) {
    assert.deepEqual(ymd(parseDateInput(input)), [2026, 4, 12], input);
  }
});

test('parseDateInput accepts day-first order', () => {
  assert.deepEqual(ymd(parseDateInput('12/05/2026')), [2026, 4, 12]);
  assert.deepEqual(ymd(parseDateInput('1-1-2026')), [2026, 0, 1]);
});

test('parseDateInput rejects impossible and empty input', () => {
  assert.equal(parseDateInput('2026-02-31'), null);
  assert.equal(parseDateInput('31/02/2026'), null);
  assert.equal(parseDateInput(''), null);
  assert.equal(parseDateInput('   '), null);
  assert.equal(parseDateInput(null), null);
  assert.equal(parseDateInput('besok'), null);
});

test('parseDateInput trims surrounding whitespace', () => {
  assert.deepEqual(ymd(parseDateInput('  2026-05-12  ')), [2026, 4, 12]);
});

test('dayStamp orders days chronologically as plain integers', () => {
  assert.equal(dayStamp(2026, 6, 27), 20260727);
  assert.equal(stampOf(new Date(2026, 6, 27)), 20260727);
  assert.ok(dayStamp(2026, 0, 1) < dayStamp(2026, 0, 2));
  assert.ok(dayStamp(2025, 11, 31) < dayStamp(2026, 0, 1), 'across a year boundary');
  assert.ok(dayStamp(2026, 8, 9) < dayStamp(2026, 9, 1), 'single-digit month padding holds');
});

test('dayStamp separates past, today and future with one comparison', () => {
  const today = stampOf(new Date(2026, 6, 27));
  assert.ok(stampOf(new Date(2026, 6, 26)) < today);
  assert.ok(stampOf(new Date(2026, 6, 28)) > today);
  assert.equal(stampOf(new Date(2026, 6, 27)), today);
});

test('dayProgress runs from 0 at midnight toward 1', () => {
  assert.equal(dayProgress(new Date(2026, 6, 27, 0, 0, 0)), 0);
  assert.ok(Math.abs(dayProgress(new Date(2026, 6, 27, 12, 0, 0)) - 0.5) < 1e-9);
  assert.ok(Math.abs(dayProgress(new Date(2026, 6, 27, 18, 0, 0)) - 0.75) < 1e-9);
});

test('dayProgress never reaches or exceeds 1', () => {
  const almost = dayProgress(new Date(2026, 6, 27, 23, 59, 59));
  assert.ok(almost < 1 && almost > 0.999);
});

test('formatFullDate renders the Indonesian long form', () => {
  assert.equal(formatFullDate(new Date(2026, 6, 27)), 'Senin, 27 Juli 2026');
  assert.equal(formatFullDate(new Date(2026, 0, 1)), 'Kamis, 1 Januari 2026');
  assert.equal(formatFullDate(new Date(2024, 1, 29)), 'Kamis, 29 Februari 2024');
});
