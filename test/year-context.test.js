import test from 'node:test';
import assert from 'node:assert/strict';
import { installDom } from './helpers/dom.js';
import { YearContext } from '../js/ui/year-context.js';

test('year context updates without rebuilding itself', () => {
  installDom();
  const context = new YearContext({ onPrevious() {}, onNext() {} });
  const element = context.element;
  context.setYear(2026);
  assert.equal(context.element, element);
  assert.equal(element.querySelector('[aria-current="true"]').textContent, '2026');
});

test('year context sends previous and next intent through its callbacks', () => {
  installDom();
  const calls = [];
  const context = new YearContext({
    onPrevious: () => calls.push('previous'),
    onNext: () => calls.push('next'),
  });
  context.element.querySelector('[data-action="previous"]').click();
  context.element.querySelector('[data-action="next"]').click();
  assert.deepEqual(calls, ['previous', 'next']);
});
