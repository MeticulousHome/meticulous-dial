import { strict as assert } from 'node:assert';

import {
  canRecordSetupWeight,
  isValidSetupWeight,
  nextStageAfterTare
} from '../src/features/freePour/setupFlow.ts';

assert.equal(
  canRecordSetupWeight({
    stage: 'server',
    weight: 312,
    stable: false,
    status: 'idle'
  }),
  false,
  'an unstable scale must not arm a delayed capture'
);

assert.equal(
  canRecordSetupWeight({
    stage: 'server',
    weight: 312,
    stable: true,
    status: 'idle'
  }),
  true
);

assert.equal(isValidSetupWeight('brewer', 0.8), false);
assert.equal(isValidSetupWeight('brewer', 1.2), true);
assert.equal(isValidSetupWeight('coffee', 4.9), false);
assert.equal(isValidSetupWeight('coffee', 18), true);
assert.equal(isValidSetupWeight('coffee', 40.1), false);

assert.equal(nextStageAfterTare('server'), 'brewer');
assert.equal(nextStageAfterTare('brewer'), 'coffee');
assert.equal(nextStageAfterTare('coffee'), 'ready');

console.log('Free Pour setup regression tests passed.');
