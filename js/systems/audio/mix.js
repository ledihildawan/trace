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
//
// `trim` is loudness normalisation, kept separate from `gain` because they
// answer different questions: trim corrects what the file happens to be, gain
// decides how loud we want it. With the files normalised, `gain` finally is a
// relative level, and the ladder is set by how often a sound is heard: a rare
// interstellar jump sits at the top, the hover that fires on every pointer
// frame at the bottom. The source files span 15.9 LUFS — theme at
// -25.4 against scroll at -9.5 — so without this, `gain` was meaningless as a
// relative level. Measured with `ffmpeg -af ebur128`, referenced to -18 LUFS:
//
//   theme  -25.4   hover  -20.9   engine -20.2   stellar -19.3   wind  -15.9
//   mute   -15.7   base   -14.4   warp   -13.9   pulse   -13.6   jump  -12.1
//   beep   -12.0   enable -11.9   scroll  -9.5
//
// Two of them (warp and jump) peaked above 0 dBFS and were clipping on their
// own; attenuating them to the reference fixes that as a side effect. With
// trim and gain combined, no voice peaks above -6.6 dBFS, and the master
// takes a further 8 dB off that.

export const BUS = {
  sfx: 'sfx',
  ambient: 'ambient',
  spatial: 'spatial',
};

export const MIX = {
  beep: { gain: 0.25, bus: BUS.spatial, trim: 0.501, detune: 40 },
  hover: { gain: 0.12, bus: BUS.spatial, trim: 1.396, detune: 60 },
  scroll: { gain: 0.35, bus: BUS.sfx, trim: 0.376, detune: 30 },
  jump: { gain: 0.85, bus: BUS.sfx, trim: 0.507, detune: 15 },
  warp: { gain: 0.7, bus: BUS.sfx, trim: 0.624, detune: 15 },
  theme: { gain: 0.55, bus: BUS.sfx, trim: 2.344, detune: 25 },
  enable: { gain: 0.6, bus: BUS.sfx, trim: 0.495 },
  mute: { gain: 0.6, bus: BUS.sfx, trim: 0.767 },
  base: { gain: 0.18, bus: BUS.ambient, trim: 0.661, loop: true, fade: 1.2 },
  pulse: { gain: 0.28, bus: BUS.spatial, trim: 0.603, detune: 50 },
  wind: { gain: 0.3, bus: BUS.spatial, trim: 0.785, detune: 50, fade: 0.8 },
  engine: { gain: 0.25, bus: BUS.ambient, trim: 1.288, fade: 0.8 },
  stellar: { gain: 0.3, bus: BUS.ambient, trim: 1.161, fade: 1 },
};

const DEFAULTS = { gain: 0.5, trim: 1, bus: BUS.sfx, detune: 0, loop: false, fade: 0 };

// Resolves a voice from the mix table plus per-call overrides. `random` is
// injectable so the pitch wander can be pinned down in tests.
export function resolveVoice(key, overrides = {}, random = Math.random) {
  const entry = MIX[key] ?? {};
  const spec = { ...DEFAULTS, ...entry, ...strip(overrides) };
  const spread = Math.max(0, spec.detune);
  return {
    // Trim first, then the level we asked for. An override of `volume` is a
    // level, so it is trimmed too — the file's loudness is not the caller's
    // problem. The result may exceed 1: lifting a quiet source is legitimate,
    // and the limiter downstream is what guards the output. The ceiling only
    // catches a mistake.
    gain: clampGain(spec.gain * (spec.trim > 0 ? spec.trim : 1)),
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
  return Object.fromEntries(
    Object.entries(overrides)
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => [key === 'volume' ? 'gain' : key, value])
  );
}

const MAX_GAIN = 4;

function clampGain(value) {
  return Math.min(MAX_GAIN, Math.max(0, Number(value) || 0));
}
