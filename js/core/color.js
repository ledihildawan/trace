// CSS colour resolution for the WebGL particle system.
//
// getComputedStyle substitutes var() but leaves colour functions unresolved,
// so a custom property comes back as literal text like
// `light-dark(oklch(45.68% 0.2146 277.02), oklch(83.69% 0.1644 84.43))`.
// Rather than hand-parse every colour syntax, hand the value to the browser
// and read back what it made of it.

// A 2D context is the browser's own parser: assigning to fillStyle resolves
// any syntax it understands — oklch(), lab(), color(), hsl(), named colours —
// down to sRGB, and silently keeps the previous value when the input is
// invalid. Writing two different sentinels first makes that case detectable.
const probe = (() => {
  try {
    return document.createElement('canvas').getContext('2d');
  } catch {
    return null; // no DOM (tests / workers): fall back to the regex paths
  }
})();

export function resolveWithBrowser(raw) {
  if (!probe) return null;
  probe.fillStyle = '#000000';
  probe.fillStyle = raw;
  const first = probe.fillStyle;
  probe.fillStyle = '#ffffff';
  probe.fillStyle = raw;
  return first === probe.fillStyle ? first : null;
}

// Splits `light-dark(a, b)` on its top-level comma. A regex cannot do this
// safely: a nested rgba(1, 2, 3) would be cut at the wrong comma.
export function splitLightDark(value) {
  const v = value.trim();
  if (!v.toLowerCase().startsWith('light-dark(') || !v.endsWith(')')) return null;
  const inner = v.slice('light-dark('.length, -1);
  let depth = 0;
  for (let i = 0; i < inner.length; i++) {
    const ch = inner[i];
    if (ch === '(') depth++;
    else if (ch === ')') depth--;
    else if (ch === ',' && depth === 0) {
      return [inner.slice(0, i).trim(), inner.slice(i + 1).trim()];
    }
  }
  return null;
}

export function hexToRgb(hex) {
  const h = hex.startsWith('#') ? hex.slice(1) : hex;
  const expanded = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  if (expanded.length !== 6 || /[^0-9a-f]/i.test(expanded)) return null;
  return [
    parseInt(expanded.substring(0, 2), 16) / 255,
    parseInt(expanded.substring(2, 4), 16) / 255,
    parseInt(expanded.substring(4, 6), 16) / 255,
  ];
}

export const FALLBACK_RGB = [0.5, 0.5, 0.5];

// Resolves a CSS colour to a normalized [r, g, b] (0–1) array.
// `isLight` picks the branch of light-dark(); the canvas probe has no element
// context and therefore cannot resolve that function itself.
export function parseColorString(raw, isLight = false) {
  if (!raw) return FALLBACK_RGB;
  const value = raw.trim();

  const branches = splitLightDark(value);
  if (branches) return parseColorString(isLight ? branches[0] : branches[1], isLight);

  const resolved = resolveWithBrowser(value) ?? value;
  if (resolved.startsWith('#')) {
    const rgb = hexToRgb(resolved);
    if (rgb) return rgb;
  }
  const m = resolved.match(/rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/);
  if (m) return [+m[1] / 255, +m[2] / 255, +m[3] / 255];
  return FALLBACK_RGB;
}
