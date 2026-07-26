// TRACE Core Utilities
// Pure utility functions used across the engine

export function hexToRgb01(hex) {
  const cleaned = hex.trim().replace(/^#/, '');
  const normalized = cleaned.length === 3 ? cleaned.replace(/(.)/g, '$1$1') : cleaned;
  if (normalized.length !== 6) return null;
  const value = Number.parseInt(normalized, 16);
  if (Number.isNaN(value)) return null;
  const r = (value >> 16) & 0xff;
  const g = (value >> 8) & 0xff;
  const b = value & 0xff;
  return { r: r / 255, g: g / 255, b: b / 255 };
}

export function srgbToLinear(c) {
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminanceFromHex(hex) {
  const rgb = hexToRgb01(hex);
  if (!rgb) return 0.5;
  const r = srgbToLinear(rgb.r);
  const g = srgbToLinear(rgb.g);
  const b = srgbToLinear(rgb.b);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function normalizeHex(hex) {
  return hex.trim().toUpperCase();
}

export function rgbToHsl(r, g, b) {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h *= 60;
  }
  return { h, s, l };
}

export function hslToRgb(h, s, l) {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const hh = h / 60;
  const x = c * (1 - Math.abs((hh % 2) - 1));
  let r1 = 0,
    g1 = 0,
    b1 = 0;
  if (0 <= hh && hh < 1) [r1, g1, b1] = [c, x, 0];
  else if (1 <= hh && hh < 2) [r1, g1, b1] = [x, c, 0];
  else if (2 <= hh && hh < 3) [r1, g1, b1] = [0, c, x];
  else if (3 <= hh && hh < 4) [r1, g1, b1] = [0, x, c];
  else if (4 <= hh && hh < 5) [r1, g1, b1] = [x, 0, c];
  else [r1, g1, b1] = [c, 0, x];
  const m = l - c / 2;
  return { r: Math.round((r1 + m) * 255), g: Math.round((g1 + m) * 255), b: Math.round((b1 + m) * 255) };
}

export function rgbToHex(r, g, b) {
  const toHex = (n) => n.toString(16).padStart(2, '0').toUpperCase();
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

export function daysInMonthUTC(year, monthIndex) {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

export function clamp(n, min, max) {
  return Math.min(Math.max(n, min), max);
}

export function pxVar(name) {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const v = Number.parseFloat(raw);
  return Number.isFinite(v) ? v : 0;
}
