import test from 'node:test';
import assert from 'node:assert/strict';
import { installDom } from './helpers/dom.js';
import { Onboarding } from '../js/ui/onboarding.js';

function makeOnboarding(options = {}) {
  installDom();
  return new Onboarding({
    storage: localStorage,
    storageKey: 'trace-onboarding-v1',
    onOpen() {},
    onClose() {},
    ...options,
  });
}

test('first visit opens onboarding and completion persists', () => {
  const onboarding = makeOnboarding();
  assert.equal(onboarding.showFirstRun(), true);
  document.querySelector('[data-action="start"]').click();
  assert.equal(localStorage.getItem('trace-onboarding-v1'), 'complete');
  assert.equal(onboarding.isOpen(), false);
  assert.equal(onboarding.hasCompleted, true);
});

test('first-run display reports false when the dialog is already visible', () => {
  let opens = 0;
  const onboarding = makeOnboarding({ onOpen: () => { opens += 1; } });
  assert.equal(onboarding.showFirstRun(), true);
  assert.equal(onboarding.showFirstRun(), false);
  assert.equal(opens, 1);
  onboarding.close();
});

test('return visit stays ambient but Help can reopen onboarding', () => {
  installDom();
  localStorage.setItem('trace-onboarding-v1', 'complete');
  const onboarding = new Onboarding({ storage: localStorage, storageKey: 'trace-onboarding-v1' });
  assert.equal(onboarding.showFirstRun(), false);
  onboarding.open();
  assert.equal(document.querySelector('.onboarding').open, true);
  onboarding.close();
});

test('opening and closing notify the host once per visible session', () => {
  const calls = [];
  const onboarding = makeOnboarding({
    onOpen: () => calls.push('open'),
    onClose: () => calls.push('close'),
  });
  onboarding.open();
  onboarding.open();
  onboarding.close();
  assert.deepEqual(calls, ['open', 'close']);
});

test('storage failures do not block closing or starting', () => {
  const brokenStorage = {
    getItem() { throw new Error('blocked'); },
    setItem() { throw new Error('blocked'); },
  };
  const onboarding = makeOnboarding({ storage: brokenStorage });
  assert.equal(onboarding.showFirstRun(), true);
  onboarding.start();
  assert.equal(onboarding.isOpen(), false);
  assert.equal(onboarding.hasCompleted, true);
});

test('a failed completion write does not suppress a future first-run prompt', () => {
  const brokenStorage = {
    getItem() { throw new Error('blocked'); },
    setItem() { throw new Error('blocked'); },
  };
  const onboarding = makeOnboarding({ storage: brokenStorage });
  onboarding.showFirstRun();
  onboarding.start();
  assert.equal(onboarding.showFirstRun(), true);
});
