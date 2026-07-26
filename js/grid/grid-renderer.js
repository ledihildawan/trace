import { OdysseyConfig } from '../config/odyssey-config.js';
import { TemporalLabels } from '../core/locale.js';
import { dayStamp } from '../core/date-utils.js';

const C = OdysseyConfig.classes;

export function computeGridCols(vw, vh) {
  if (vw < OdysseyConfig.render.wideViewportPx) return OdysseyConfig.display.minCols;
  const approx = Math.ceil(Math.sqrt(OdysseyConfig.render.layoutRatioNumerator * (vw / vh)));
  return Math.ceil(approx / OdysseyConfig.display.minCols) * OdysseyConfig.display.minCols;
}

export function computeYearOffset(year, cols, structured) {
  const jan1 = new Date(year, 0, 1);
  if (structured) return (jan1.getDay() + 6) % 7;
  return Math.floor(jan1.getTime() / 86400000) % cols;
}

export function buildBlockSkeleton(year, yPos) {
  const block = document.createElement('section');
  block.className = C.yearBlock;
  block.style.top = `${yPos}px`;
  block.dataset.year = year;
  block.dataset.pooled = 'false';
  block.dataset.detailed = 'false';
  return block;
}

export function buildGridContainer(year, isScrollable) {
  const cont = document.createElement('div');
  cont.className = C.gridContainer;
  cont.style.overflowY = isScrollable ? 'auto' : 'hidden';

  const watermark = document.createElement('div');
  watermark.className = C.watermark;
  watermark.setAttribute('aria-hidden', 'true');
  watermark.innerText = year;
  cont.append(watermark);
  return cont;
}

export function buildGridLayer(year, cols, rows, isScrollable) {
  const grid = document.createElement('div');
  grid.className = C.gridLayer;
  grid.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
  grid.style.gridTemplateRows = isScrollable
    ? `repeat(${rows}, minmax(${OdysseyConfig.render.minCellPx}px, 1fr))`
    : `repeat(${rows}, 1fr)`;
  grid.style.height = isScrollable ? 'auto' : '100%';
  // Real grid semantics: grid > row > gridcell. The row wrappers are
  // `display: contents` so the cells stay direct participants of the CSS grid.
  grid.setAttribute('role', 'grid');
  grid.setAttribute('aria-label', `Kalender tahun ${year}`);
  grid.setAttribute('aria-rowcount', String(rows));
  grid.setAttribute('aria-colcount', String(cols));
  return grid;
}

export function isScrollableLayout(rows, vh) {
  return vh / rows < OdysseyConfig.render.minCellPx;
}

function cellClasses(itD, stamp, todayStamp, detailed) {
  const cls = [C.cell];
  const day = itD.getDay();
  // "Temporal fading": days already lived recede instead of vanishing.
  if (stamp < todayStamp) cls.push(C.past);
  else if (stamp === todayStamp) cls.push(C.today);
  if (itD.getDate() === 1) cls.push(C.monthStart);
  if (day === 0 || day === 6) cls.push(C.weekend);
  if (day === 1) cls.push(C.weekStart);
  // A detailed cell is already in its final form, so enrichment can skip it.
  if (detailed) cls.push(C.enriched);
  return cls;
}

// Inner markup of a fully-labelled cell: month tag, date, weekday tag.
function contentHTML(monthIdx, dayIdx, dateNum, isMonthStart) {
  const t = TemporalLabels;
  const monthLabel = isMonthStart ? t.monthsShort[monthIdx] : '';
  const dayLabel = t.daysShort[dayIdx];
  const topLabel = isMonthStart ? ` ${C.topLabel}` : '';
  return `<span class="${C.infoMeta}${topLabel}">${monthLabel}</span>`
    + `<span class="${C.dateNum}">${dateNum}</span>`
    + `<span class="${C.infoMeta}">${dayLabel}</span>`;
}

const FILLER_HTML =
  `<div class="${C.cell} ${C.filler}" data-is-filler="true" aria-hidden="true">`
  + `<div class="${C.cellContent}"><span class="${C.dateNum}"></span></div></div>`;

// One cell as an HTML string. Every real day carries the same data attributes
// regardless of `detailed`, because click focus, keyboard day navigation and
// the note/mood markers all read them.
function cellHTML(itD, year, todayStamp, detailed) {
  if (itD.getFullYear() !== year) return FILLER_HTML;

  const monthIdx = itD.getMonth();
  const dayIdx = itD.getDay();
  const dateNum = itD.getDate();
  const isMonthStart = dateNum === 1;
  const stamp = dayStamp(year, monthIdx, dateNum);
  const cls = cellClasses(itD, stamp, todayStamp, detailed);
  const t = TemporalLabels;
  const label = `${t.daysFull[dayIdx]}, ${dateNum} ${t.monthsFull[monthIdx]} ${year}`;
  const current = cls.includes(C.today) ? ' aria-current="date"' : '';
  const inner = detailed
    ? contentHTML(monthIdx, dayIdx, dateNum, isMonthStart)
    : `<span class="${C.dateNum}">${dateNum}</span>`;

  // Sibling of .cell-content so enrichCell (which rewrites the content) leaves it alone.
  const pulse = stamp === todayStamp ? `<span class="${C.dayPulse}" aria-hidden="true"></span>` : '';

  return `<div class="${cls.join(' ')}" role="gridcell" tabindex="-1" aria-label="${label}"${current}`
    + ` data-month="${monthIdx}" data-day="${dayIdx}" data-date="${dateNum}"`
    + ` data-is-filler="false" data-is-month-start="${isMonthStart}">`
    + `${pulse}<div class="${C.cellContent}">${inner}</div></div>`;
}

// Builds the whole year as a single HTML string so the browser parses it once,
// instead of running one innerHTML parse per cell (~400 per year block).
export function buildYearCellsHTML(year, cols, rows, offset, todayStamp, detailed) {
  const itD = new Date(year, 0, 1 - offset);
  const out = [];
  for (let r = 0; r < rows; r++) {
    out.push(`<div class="${C.gridRow}" role="row" aria-rowindex="${r + 1}">`);
    for (let c = 0; c < cols; c++) {
      out.push(cellHTML(itD, year, todayStamp, detailed));
      itD.setDate(itD.getDate() + 1);
    }
    out.push('</div>');
  }
  return out.join('');
}

// Upgrades a minimal cell (date only) to the fully-labelled form.
export function enrichCell(cell, monthIdx, dayIdx, dateNum, isMonthStart) {
  const content = cell.querySelector(`.${C.cellContent}`);
  if (!content) return;
  content.innerHTML = contentHTML(monthIdx, dayIdx, dateNum, isMonthStart);
}
