import assert from 'node:assert/strict';
import test from 'node:test';

import { createStartBrewGestureHandlers } from '../src/components/Heating/startBrewGestures.ts';

test('long press starts once and release has no duplicate handler', () => {
  const actions = [];
  const handlers = createStartBrewGestureHandlers(true, 'push_to_brew', () =>
    actions.push('continue')
  );

  handlers.longEncoder();
  handlers.pressUp?.();

  assert.deepEqual(actions, ['continue']);
});

test('short press still starts once', () => {
  const actions = [];
  const handlers = createStartBrewGestureHandlers(true, 'push_to_brew', () =>
    actions.push('continue')
  );

  handlers.click();

  assert.deepEqual(actions, ['continue']);
});

test('long press is ignored until heating finishes or for other options', () => {
  const actions = [];
  createStartBrewGestureHandlers(false, 'push_to_brew', () =>
    actions.push('continue')
  ).longEncoder();
  createStartBrewGestureHandlers(true, 'auto_start', () =>
    actions.push('continue')
  ).longEncoder();

  assert.deepEqual(actions, []);
});
