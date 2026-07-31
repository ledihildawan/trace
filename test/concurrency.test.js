import test from 'node:test';
import assert from 'node:assert/strict';
import { runWithLimit } from '../js/core/concurrency.js';

// Promise.withResolvers replaces the let-resolve-outside dance.
const deferred = () => Promise.withResolvers();

test('an empty task list resolves immediately', async () => {
  await runWithLimit([], 2);
});

test('every task runs exactly once', async () => {
  const seen = [];
  await runWithLimit([1, 2, 3, 4, 5].map((n) => () => { seen.push(n); }), 2);
  assert.deepEqual(seen.sort(), [1, 2, 3, 4, 5]);
});

test('never more than `limit` are in flight at once', async () => {
  let active = 0;
  let peak = 0;
  const tasks = Array.from({ length: 12 }, () => async () => {
    active++;
    peak = Math.max(peak, active);
    await new Promise((r) => setTimeout(r, 1));
    active--;
  });
  await runWithLimit(tasks, 3);
  assert.equal(peak, 3, `peak concurrency was ${peak}`);
  assert.equal(active, 0);
});

test('a slot is only freed when its task settles', async () => {
  const gate = deferred();
  let started = 0;
  const tasks = Array.from({ length: 4 }, () => async () => { started++; await gate.promise; });
  const all = runWithLimit(tasks, 2);
  await Promise.resolve();
  assert.equal(started, 2, 'the other two wait for a free slot');
  gate.resolve();
  await all;
  assert.equal(started, 4);
});

test('one failing task does not abort the batch', async () => {
  // A single undecodable audio file must not stop the rest from loading.
  const done = [];
  await runWithLimit([
    async () => { done.push('a'); },
    async () => { throw new Error('boom'); },
    async () => { done.push('c'); },
  ], 2);
  assert.deepEqual(done.sort(), ['a', 'c']);
});

test('a nonsense limit still makes progress', async () => {
  const done = [];
  await runWithLimit([() => done.push(1), () => done.push(2)], 0);
  assert.deepEqual(done, [1, 2]);
});
