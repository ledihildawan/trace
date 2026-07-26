// The mix: one place that says how loud each sound is, which bus it runs
// through, and how much it may wander in pitch.
//
// These levels used to live as bare numbers at the call sites — 0.25 here,
// 0.6 there — so the balance of the piece was spread across five files and
// impossible to adjust as a whole.
//
// `detune` is in cents and applied as ±detune at random per voice. Firing the
// identical sample repeatedly is what makes UI audio sound like a machine gun;
// a few cents of wander is what stops it.

export const BUS = {
  sfx: 'sfx',
  ambient: 'ambient',
  spatial: 'spatial',
};

export const MIX = {
  beep: { gain: 0.15, bus: BUS.spatial, detune: 40 },
  hover: { gain: 0.25, bus: BUS.spatial, detune: 60 },
  scroll: { gain: 0.25, bus: BUS.sfx, detune: 30 },
  jump: { gain: 0.6, bus: BUS.sfx, detune: 15 },
  warp: { gain: 0.5, bus: BUS.sfx, detune: 15 },
  theme: { gain: 0.5, bus: BUS.sfx, detune: 25 },
  enable: { gain: 0.5, bus: BUS.sfx },
  mute: { gain: 0.5, bus: BUS.sfx },
  base: { gain: 0.12, bus: BUS.ambient, loop: true, fade: 1.2 },
  pulse: { gain: 0.15, bus: BUS.spatial, detune: 50 },
  wind: { gain: 0.2, bus: BUS.spatial, detune: 50, fade: 0.8 },
  engine: { gain: 0.15, bus: BUS.ambient, fade: 0.8 },
  stellar: { gain: 0.2, bus: BUS.ambient, fade: 1 },
};

const DEFAULTS = { gain: 0.5, bus: BUS.sfx, detune: 0, loop: false, fade: 0 };

// Resolves a voice from the mix table plus per-call overrides. `random` is
// injectable so the pitch wander can be pinned down in tests.
export function resolveVoice(key, overrides = {}, random = Math.random) {
  const entry = MIX[key] ?? {};
  const spec = { ...DEFAULTS, ...entry, ...strip(overrides) };
  const spread = Math.max(0, spec.detune);
  return {
    gain: clamp01(spec.gain),
    bus: BUS[spec.bus] ? spec.bus : BUS.sfx,
    loop: Boolean(spec.loop),
    fade: Math.max(0, spec.fade),
    playbackRate: spec.playbackRate > 0 ? spec.playbackRate : 1,
    // ±spread cents, so repeats of the same sample never land identically.
    detune: spread === 0 ? 0 : Math.round((random() * 2 - 1) * spread),
  };
}

// Callers pass { volume } rather than { gain }; undefined must not clobber a
// table entry, which a plain spread would do.
function strip(overrides) {
  const out = {};
  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined) continue;
    out[key === 'volume' ? 'gain' : key] = value;
  }
  return out;
}

function clamp01(value) {
  return Math.min(1, Math.max(0, Number(value) || 0));
}
