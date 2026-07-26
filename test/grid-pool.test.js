import test from 'node:test';
import assert from 'node:assert/strict';
import { installDom } from './helpers/dom.js';

installDom();

const { GridPool } = await import('../js/grid/grid-pool.js');
const { buildBlockSkeleton } = await import('../js/grid/grid-renderer.js');

const newPool = () => new GridPool((year, yPos) => buildBlockSkeleton(year, yPos));

test('a fresh pool builds a block through its factory', () => {
  const pool = newPool();
  const block = pool.acquire(2026, 480);
  assert.equal(block.dataset.year, '2026');
  assert.equal(block.style.top, '480px');
  assert.equal(block.dataset.detailed, 'false');
});

test('a released block is handed back rather than rebuilt', () => {
  const pool = newPool();
  const first = pool.acquire(2026, 0);
  pool.release(first);
  const second = pool.acquire(2027, 960);

  assert.equal(second, first, 'same element reused');
  assert.equal(second.dataset.year, '2027', 're-stamped with the new year');
  assert.equal(second.style.top, '960px');
  assert.equal(second.style.display, '', 'made visible again');
});

test('reuse clears the previous year out of the block', () => {
  // Stale grid containers and watermarks accumulating on reuse was a real bug.
  const pool = newPool();
  const block = pool.acquire(2026, 0);
  block.append(document.createElement('div'), document.createElement('div'));
  assert.equal(block.children.length, 2);

  pool.release(block);
  assert.equal(pool.acquire(2027, 0).children.length, 0, 'must start empty');
});

test('reuse resets the flags that drive rendering', () => {
  const pool = newPool();
  const block = pool.acquire(2026, 0);
  block.dataset.detailed = 'true';
  block.classList.add('active', 'is-scrolling');

  pool.release(block);
  const reused = pool.acquire(2027, 0);
  assert.equal(reused.dataset.detailed, 'false');
  assert.equal(reused.dataset.pooled, 'false');
  assert.equal(reused.classList.contains('active'), false);
  assert.equal(reused.classList.contains('is-scrolling'), false);
});

test('a released block is hidden and marked while it waits', () => {
  const pool = newPool();
  const block = pool.acquire(2026, 0);
  pool.release(block);
  assert.equal(block.style.display, 'none');
  assert.equal(block.dataset.pooled, 'true');
});

test('the pool is bounded: extra blocks are dropped from the document', () => {
  const pool = newPool();
  const blocks = Array.from({ length: 10 }, (_, i) => pool.acquire(2000 + i, 0));
  blocks.forEach((b) => document.body.append(b));
  blocks.forEach((b) => pool.release(b));

  const detached = blocks.filter((b) => !b.isConnected);
  assert.ok(detached.length >= 3, 'blocks past the cap are removed, not retained');
  assert.ok(blocks.some((b) => b.isConnected === false));
});

test('acquiring more than were pooled falls back to the factory', () => {
  const pool = newPool();
  const a = pool.acquire(2026, 0);
  pool.release(a);
  const first = pool.acquire(2027, 0);
  const second = pool.acquire(2028, 0);
  assert.equal(first, a, 'the pooled one comes back');
  assert.notEqual(second, a, 'the next is built fresh');
});
