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

test('a voice resolves from the table when nothing is overridden', () => {
  const voice = resolveVoice('jump', {}, mid);
  assert.equal(voice.gain, MIX.jump.gain);
  assert.equal(voice.bus, BUS.sfx);
  assert.equal(voice.loop, false);
  assert.equal(voice.playbackRate, 1);
});

test('an unknown key still yields a usable voice', () => {
  const voice = resolveVoice('nope', {}, mid);
  assert.ok(voice.gain > 0 && voice.gain <= 1);
  assert.equal(voice.bus, BUS.sfx);
});

test('callers override with volume, and undefined never clobbers the table', () => {
  assert.equal(resolveVoice('hover', { volume: 0.04 }, mid).gain, 0.04);
  assert.equal(resolveVoice('hover', { volume: undefined }, mid).gain, MIX.hover.gain);
  assert.equal(resolveVoice('hover', {}, mid).gain, MIX.hover.gain);
});

test('gain is clamped into range whatever the caller passes', () => {
  assert.equal(resolveVoice('beep', { volume: 5 }, mid).gain, 1);
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
