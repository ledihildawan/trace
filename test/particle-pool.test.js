import test from 'node:test';
import assert from 'node:assert/strict';

import { ParticlePool, computeCapacity } from '../js/systems/particle-core.js';
import { OdysseyConfig } from '../js/config/odyssey-config.js';

const CFG = OdysseyConfig.particles;
const RED = [1, 0, 0];
const BLUE = [0, 0, 1];

test('capacity scales with area but stays within its floor and ceiling', () => {
  assert.equal(computeCapacity(100, 100), CFG.maxBase, 'tiny viewport clamps to the floor');
  assert.equal(computeCapacity(10000, 10000), CFG.maxCeiling, 'huge viewport clamps to the ceiling');
  assert.equal(computeCapacity(800, 600), Math.floor((800 * 600) / CFG.maxPerAreaPx));
});

test('exhaust and ambient bursts emit their configured counts', () => {
  const exhaust = new ParticlePool(500, 1);
  exhaust.spawn(0, 0, true, RED, BLUE, false);
  assert.equal(exhaust.count, CFG.exhaustCount);

  const ambient = new ParticlePool(500, 1);
  ambient.spawn(0, 0, false, RED, BLUE, false);
  assert.equal(ambient.count, CFG.ambientCount);
});

test('spawn position is scaled by device pixel ratio', () => {
  const pool = new ParticlePool(10, 2);
  pool.spawn(10, 20, true, RED, BLUE, false);
  const { pos } = pool.vertexData;
  assert.equal(pos[0], 20);
  assert.equal(pos[1], 40);
});

test('exhaust uses the primary colour, ambient the secondary', () => {
  const exhaust = new ParticlePool(10, 1);
  exhaust.spawn(0, 0, true, RED, BLUE, false);
  assert.deepEqual([...exhaust.vertexData.color.slice(0, 3)], [1, 0, 0]);

  const ambient = new ParticlePool(50, 1);
  ambient.spawn(0, 0, false, RED, BLUE, false);
  assert.deepEqual([...ambient.vertexData.color.slice(0, 3)], [0, 0, 1]);
});

test('light theme scales colour down for contrast', () => {
  const pool = new ParticlePool(10, 1);
  pool.spawn(0, 0, true, RED, BLUE, true);
  assert.ok(Math.abs(pool.vertexData.color[0] - CFG.contrastScaleLight) < 1e-6);
});

test('the pool never grows past its capacity', () => {
  const pool = new ParticlePool(10, 1);
  for (let i = 0; i < 50; i++) pool.spawn(i, i, false, RED, BLUE, false);
  assert.equal(pool.count, 10);
  assert.equal(pool.vertexData.length, 10);
});

test('particles expire after their configured lifetime and drain the pool', () => {
  const pool = new ParticlePool(10, 1);
  pool.spawn(5, 5, true, RED, BLUE, false);
  let frames = 0;
  while (pool.step() > 0 && frames < 10_000) frames++;
  // life starts at 1 and loses `decay` per frame; the frame it reaches 0 is culled.
  assert.equal(frames, Math.ceil(1 / CFG.exhaustDecay) - 1);
  assert.equal(pool.count, 0);
  assert.equal(pool.vertexData.length, 0);
});

test('ambient particles outlive exhaust particles', () => {
  const run = (isExhaust) => {
    const pool = new ParticlePool(30, 1);
    pool.spawn(0, 0, isExhaust, RED, BLUE, false);
    let n = 0;
    while (pool.step() > 0 && n < 10_000) n++;
    return n;
  };
  assert.ok(run(false) > run(true));
});

test('compaction keeps survivors intact when older particles die', () => {
  const pool = new ParticlePool(100, 1);
  pool.spawn(0, 0, true, RED, BLUE, false);        // short-lived, primary colour
  for (let i = 0; i < 20; i++) pool.step();
  pool.spawn(100, 200, false, RED, BLUE, false);   // long-lived, secondary colour
  for (let i = 0; i < 10; i++) pool.step();

  assert.equal(pool.count, CFG.ambientCount, 'only the ambient burst should remain');
  const d = pool.vertexData;
  for (let i = 0; i < d.length; i++) {
    assert.deepEqual([...d.color.slice(i * 3, i * 3 + 3)], [0, 0, 1], 'colour survived compaction');
    assert.ok(Number.isFinite(d.pos[i * 2]) && Number.isFinite(d.pos[i * 2 + 1]));
    assert.ok(d.life[i] > 0 && d.life[i] <= 1);
  }
});

test('drag decelerates particles without reversing them', () => {
  const pool = new ParticlePool(10, 1);
  pool.spawn(0, 0, false, RED, BLUE, false);
  pool.step();
  const v1 = Math.hypot(pool.vertexData.vel[0], pool.vertexData.vel[1]);
  pool.step();
  const v2 = Math.hypot(pool.vertexData.vel[0], pool.vertexData.vel[1]);
  assert.ok(v2 < v1 && v2 > 0, `expected decay, got ${v1} -> ${v2}`);
});

test('vertex data views match the live particle count', () => {
  const pool = new ParticlePool(50, 1);
  pool.spawn(0, 0, false, RED, BLUE, false);
  pool.step();
  const n = pool.count;
  const d = pool.vertexData;
  assert.equal(d.length, n);
  assert.equal(d.pos.length, n * 2);
  assert.equal(d.vel.length, n * 2);
  assert.equal(d.life.length, n);
  assert.equal(d.size.length, n);
  assert.equal(d.color.length, n * 3);
});
