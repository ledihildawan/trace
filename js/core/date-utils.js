import { TemporalLabels } from './locale.js';

// Pure calendar arithmetic and formatting. No DOM, no state — everything here
// is a function of its arguments, which is what makes it testable.

export function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function daysInYear(year) {
  return isLeapYear(year) ? 366 : 365;
}

export function daysInMonth(year, monthIndex) {
  return new Date(year, monthIndex + 1, 0).getDate();
}

// A calendar day as one comparable integer (20260727). Ordering matches
// chronological order, so past/today/future is a single numeric comparison —
// no Date allocation and no string building in the per-cell render path.
export function dayStamp(year, monthIndex, day) {
  return year * 10000 + (monthIndex + 1) * 100 + day;
}

export function stampOf(date) {
  return dayStamp(date.getFullYear(), date.getMonth(), date.getDate());
}

// Fraction of the local day already elapsed, 0 at midnight → 1 at the next.
export function dayProgress(now = new Date()) {
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return (now - midnight) / 86_400_000;
}

export function shiftDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function endOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

// Moves by whole months, clamping the day to the target month's length.
// Plain `new Date(y, m - 1, 31)` silently rolls over — stepping back a month
// from 31 March would land on 3 March instead of 28 February.
export function addMonths(date, delta) {
  const year = date.getFullYear();
  const month = date.getMonth() + delta;
  const target = new Date(year, month, 1);
  const day = Math.min(date.getDate(), daysInMonth(target.getFullYear(), target.getMonth()));
  return new Date(target.getFullYear(), target.getMonth(), day);
}

// `new Date(y, m, d)` maps years 0–99 onto 1900–1999 for legacy reasons, so
// year 7 would silently become 1907. setFullYear has no such rule.
function rawDate(year, monthIndex, day) {
  const date = new Date(year, monthIndex, day);
  if (year >= 0 && year < 100) date.setFullYear(year, monthIndex, day);
  return date;
}

// Builds a date only if the components describe a real day, so 31 February
// is rejected instead of silently becoming 3 March.
export function makeValidDate(year, monthIndex, day) {
  const date = rawDate(year, monthIndex, day);
  if (date.getFullYear() !== year || date.getMonth() !== monthIndex || date.getDate() !== day) {
    return null;
  }
  return date;
}

// Tolerant parser for the jump-to-date box: year alone, YYYY-MM-DD,
// DD-MM-YYYY (with - / or . separators), or anything Date itself accepts.
export function parseDateInput(raw) {
  const s = String(raw ?? '').trim();
  if (!s) return null;

  if (/^\d{1,4}$/.test(s)) {
    const year = Number(s);
    return year >= 1 && year <= 9999 ? rawDate(year, 0, 1) : null;
  }

  const iso = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (iso) return makeValidDate(+iso[1], +iso[2] - 1, +iso[3]);

  const dmy = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (dmy) return makeValidDate(+dmy[3], +dmy[2] - 1, +dmy[1]);

  const fallback = new Date(s);
  return Number.isNaN(fallback.getTime()) ? null : fallback;
}

// "Senin, 27 Juli 2026" — the one spelling of a full date in the app.
export function formatFullDate(date) {
  const t = TemporalLabels;
  return `${t.daysFull[date.getDay()]}, ${date.getDate()} ${t.monthsFull[date.getMonth()]} ${date.getFullYear()}`;
}
