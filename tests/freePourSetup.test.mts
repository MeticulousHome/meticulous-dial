import { strict as assert } from 'node:assert';

import {
  canRecordSetupWeight,
  isValidSetupWeight,
  nextStageAfterTare,
  normalizeBrewerWeight
} from '../src/features/freePour/setupFlow.ts';
import { formatBrewTime } from '../src/features/freePour/format.ts';

assert.equal(formatBrewTime(195_000), '3:15');

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

assert.equal(isValidSetupWeight('brewer', 0), true);
assert.equal(isValidSetupWeight('brewer', -0.6), true);
assert.equal(isValidSetupWeight('brewer', 0.6), true);
assert.equal(isValidSetupWeight('brewer', -0.7), false);
assert.equal(isValidSetupWeight('brewer', 0.8), false);
assert.equal(isValidSetupWeight('brewer', 1.2), true);
assert.equal(isValidSetupWeight('brewer', Number.NaN), false);
assert.equal(isValidSetupWeight('brewer', Number.POSITIVE_INFINITY), false);
assert.equal(normalizeBrewerWeight(0.4), 0);
assert.equal(normalizeBrewerWeight(-0.6), 0);
assert.equal(normalizeBrewerWeight(40), 40);
assert.equal(
  canRecordSetupWeight({
    stage: 'brewer',
    weight: 0,
    stable: true,
    status: 'idle'
  }),
  true,
  'a stable zero reading must support an integrated brewer such as a Chemex'
);
assert.equal(
  canRecordSetupWeight({
    stage: 'brewer',
    weight: 0,
    stable: false,
    status: 'idle'
  }),
  false,
  'zero brewer capture must still wait for a stable scale'
);
assert.equal(isValidSetupWeight('coffee', 4.9), false);
assert.equal(isValidSetupWeight('coffee', 18), true);
assert.equal(isValidSetupWeight('coffee', 40.1), false);

assert.equal(nextStageAfterTare('server'), 'brewer');
assert.equal(nextStageAfterTare('brewer'), 'coffee');
assert.equal(nextStageAfterTare('coffee'), 'ready');

console.log('Free Pour setup regression tests passed.');
