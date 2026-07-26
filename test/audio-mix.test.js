import test from 'node:test';
import assert from 'node:assert/strict';

import { BUS, MIX, resolveVoice } from '../js/systems/audio/mix.js';
import { ASSET_QUEUE, IDLE_CLIPS } from '../js/systems/audio/asset-manifest.js';

const mid = () => 0.5;   // random() === 0.5 → no detune offset
const low = () => 0;     // → -spread
const high = () => 1;    // → +spread

test('every clip that can be played has a mix entry', () => {
  // Without this a new sound falls back to a default level and quietly sits
  // at the wrong place in the balance.
  for (const { key } of ASSET_QUEUE) {
    assert.ok(MIX[key], `no mix entry for "${key}"`);
  }
});

test('every mix entry names a real bus and a sane level', () => {
  for (const [key, entry] of Object.entries(MIX)) {
    assert.ok(Object.values(BUS).includes(entry.bus), `${key}: unknown bus ${entry.bus}`);
    assert.ok(entry.gain > 0 && entry.gain <= 1, `${key}: gain ${entry.gain} out of range`);
  }
});

test('the idle shortlist refers to real clips', () => {
  const known = new Set(ASSET_QUEUE.map((a) => a.key));
  for (const key of IDLE_CLIPS) assert.ok(known.has(key), `idle clip "${key}" has no asset`);
});

test('the sounds tied to the pointer are the ones that pan', () => {
  // Routing lives in the mix table alone. A second list of spatial keys had
  // already drifted out of sync with it before this test existed.
  const spatial = Object.entries(MIX).filter(([, e]) => e.bus === BUS.spatial).map(([k]) => k);
  assert.deepEqual(spatial.sort(), ['beep', 'hover', 'pulse', 'wind']);
});

test('every clip carries a loudness trim', () => {
  // Without it, `gain` is not a relative level: the source files span 15.9
  // LUFS, so the same gain on two clips is not the same loudness.
  for (const [key, entry] of Object.entries(MIX)) {
    assert.ok(entry.trim > 0, `${key} has no trim`);
  }
});

test('normalisation is applied on top of the artistic level', () => {
  const jump = resolveVoice('jump', {}, mid);
  assert.ok(Math.abs(jump.gain - MIX.jump.gain * MIX.jump.trim) < 1e-9);
});

test('a quiet source is lifted and a loud one is pulled down', () => {
  // theme measured -25.4 LUFS, scroll -9.5, both referenced to -18.
  assert.ok(MIX.theme.trim > 1, 'the quietest clip needs boosting');
  assert.ok(MIX.scroll.trim < 1, 'the loudest clip needs attenuating');
});

test('no voice is loud enough to clip on its own', () => {
  // True peak of each source, measured with ffmpeg. gain x trim must leave
  // the loudest sample below full scale before the limiter is asked to help.
  const peakDb = {
    beep: -0.86, stellar: -5.34, enable: -0.19, engine: -7.48, warp: 0.64,
    hover: -11.59, jump: 0.59, base: -0.16, mute: -1.24, wind: -2.64,
    pulse: -0.44, theme: -12.83, scroll: -0.01,
  };
  for (const key of Object.keys(MIX)) {
    const voice = resolveVoice(key, {}, mid);
    const after = peakDb[key] + 20 * Math.log10(voice.gain);
    assert.ok(after < -3, `${key} would peak at ${after.toFixed(1)} dBFS`);
  }
});

test('the level ladder follows how often a sound is heard', () => {
  // Compare faders, not resolved gains. Once trim has normalised every source
  // to the same reference, `gain` *is* the relative loudness; the resolved
  // value still carries each file's own correction and is not comparable
  // across clips.
  const fader = (k) => MIX[k].gain;
  assert.ok(fader('jump') > fader('scroll'), 'a rare jump beats routine navigation');
  assert.ok(fader('scroll') > fader('base'), 'navigation beats the always-on bed');
  assert.ok(fader('base') > fader('hover'), 'the bed beats the per-frame hover');
  assert.ok(fader('warp') > fader('beep'), 'a warp beats a click');
});

test('gain may exceed unity so a quiet source can be lifted', () => {
  // theme needs +7.4 dB; clamping at 1 would have silently undone that.
  assert.ok(MIX.theme.trim > 2);
  assert.ok(resolveVoice('theme', { volume: 1 }, mid).gain > 1);
});

test('an overridden volume is trimmed too', () => {
  // The file's loudness is not the caller's problem.
  const voice = resolveVoice('hover', { volume: 0.04 }, mid);
  assert.ok(Math.abs(voice.gain - 0.04 * MIX.hover.trim) < 1e-9);
});

test('a voice resolves from the table when nothing is overridden', () => {
  const voice = resolveVoice('jump', {}, mid);
  assert.ok(voice.gain > 0);
  assert.equal(voice.bus, BUS.sfx);
  assert.equal(voice.loop, false);
  assert.equal(voice.playbackRate, 1);
});

test('an unknown key still yields a usable voice', () => {
  const voice = resolveVoice('nope', {}, mid);
  assert.ok(voice.gain > 0 && voice.gain <= 1);
  assert.equal(voice.bus, BUS.sfx);
});

test('undefined never clobbers the table', () => {
  const fromTable = resolveVoice('hover', {}, mid).gain;
  assert.equal(resolveVoice('hover', { volume: undefined }, mid).gain, fromTable);
});

test('a nonsensical level is caught rather than passed through', () => {
  assert.equal(resolveVoice('beep', { volume: 5000 }, mid).gain, 4, 'ceiling');
  assert.equal(resolveVoice('beep', { volume: -2 }, mid).gain, 0);
  assert.equal(resolveVoice('beep', { volume: 'loud' }, mid).gain, 0);
});

test('detune wanders both ways within the configured spread', () => {
  // Repeating a sample at exactly the same pitch is what makes UI audio
  // sound mechanical; this is the spread that prevents it.
  const spread = MIX.beep.detune;
  assert.equal(resolveVoice('beep', {}, low).detune, -spread);
  assert.equal(resolveVoice('beep', {}, high).detune, spread);
  assert.equal(resolveVoice('beep', {}, mid).detune, 0);
});

test('clips with no detune configured never wander', () => {
  assert.equal(resolveVoice('enable', {}, low).detune, 0);
  assert.equal(resolveVoice('enable', {}, high).detune, 0);
});

test('the ambient bed loops and fades in', () => {
  const voice = resolveVoice('base', {}, mid);
  assert.equal(voice.loop, true);
  assert.ok(voice.fade > 0, 'starting a loop at full level clicks');
  assert.equal(voice.bus, BUS.ambient);
});

test('one-shots do not loop and start instantly', () => {
  const voice = resolveVoice('beep', {}, mid);
  assert.equal(voice.loop, false);
  assert.equal(voice.fade, 0, 'a click sound must not ramp in');
});

test('an invalid playback rate falls back to normal speed', () => {
  assert.equal(resolveVoice('beep', { playbackRate: 0 }, mid).playbackRate, 1);
  assert.equal(resolveVoice('beep', { playbackRate: -1 }, mid).playbackRate, 1);
  assert.equal(resolveVoice('beep', { playbackRate: 1.5 }, mid).playbackRate, 1.5);
});

test('an unknown bus override is ignored rather than silencing the voice', () => {
  assert.equal(resolveVoice('beep', { bus: 'nowhere' }, mid).bus, BUS.sfx);
});
