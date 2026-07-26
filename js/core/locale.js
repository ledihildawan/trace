import { OdysseyConfig } from '../config/odyssey-config.js';

// Month and weekday names come from the platform's own CLDR data instead of
// four hand-maintained arrays. Each formatter is built once and reused, so
// this costs nothing in the per-cell render path.

// 1 August 2021 was a Sunday, so offsets 0–6 line up with Date#getDay().
const WEEK_ANCHOR = new Date(2021, 7, 1);
const MONTH_ANCHOR_YEAR = 2021;

function listMonths(locale, style) {
  const fmt = new Intl.DateTimeFormat(locale, { month: style });
  return Array.from({ length: 12 }, (_, month) =>
    fmt.format(new Date(MONTH_ANCHOR_YEAR, month, 1)));
}

function listWeekdays(locale, style) {
  const fmt = new Intl.DateTimeFormat(locale, { weekday: style });
  return Array.from({ length: 7 }, (_, offset) =>
    fmt.format(new Date(
      WEEK_ANCHOR.getFullYear(),
      WEEK_ANCHOR.getMonth(),
      WEEK_ANCHOR.getDate() + offset
    )));
}

export function buildTemporalLabels(locale = OdysseyConfig.temporal.locale) {
  return {
    locale,
    monthsShort: listMonths(locale, 'short'),
    monthsFull: listMonths(locale, 'long'),
    daysShort: listWeekdays(locale, 'short'),
    daysFull: listWeekdays(locale, 'long'),
  };
}

// Resolved once at startup; the app renders a single locale per session.
export const TemporalLabels = buildTemporalLabels();
