import assert from 'node:assert/strict';
import test from 'node:test';

import {
  decideDoubleClick,
  isUserStage
} from '../src/hooks/brewDoubleClick.ts';
import { MACHINE_OWNED_STAGES } from '../src/constants/setting.ts';

test('idle is never acted on, even if extracting is somehow true', () => {
  assert.equal(decideDoubleClick({ name: 'idle', extracting: false }), null);
  assert.equal(decideDoubleClick({ name: 'idle', extracting: true }), null);
});

test('every machine-owned stage aborts while extracting', () => {
  for (const name of MACHINE_OWNED_STAGES) {
    const expected = name === 'idle' ? null : 'abort';
    assert.equal(
      decideDoubleClick({ name, extracting: true }),
      expected,
      `${name} while extracting`
    );
  }
});

test('the final retract aborts rather than finishing', () => {
  // `extracting` is still true here, so only the name keeps this out of
  // the user-stage branch.
  assert.equal(decideDoubleClick({ name: 'retracting', extracting: true }), 'abort');
});

test('machine-owned stages abort when not extracting', () => {
  assert.equal(decideDoubleClick({ name: 'heating', extracting: false }), 'abort');
  assert.equal(
    decideDoubleClick({ name: 'click to start', extracting: false }),
    'abort'
  );
});

test('a profile stage finishes only while extracting', () => {
  assert.equal(
    decideDoubleClick({ name: 'Pre-infusion', extracting: true }),
    'finish'
  );
  assert.equal(
    decideDoubleClick({ name: 'Pre-infusion', extracting: false }),
    'abort'
  );
});

test('isUserStage direct cases', () => {
  assert.equal(isUserStage({ name: 'Pre-infusion', extracting: true }), true);
  assert.equal(isUserStage({ name: 'Pre-infusion', extracting: false }), false);
  assert.equal(isUserStage({ name: 'retracting', extracting: true }), false);
  assert.equal(isUserStage({ name: 'idle', extracting: false }), false);
});

test('the machine-owned list can be injected', () => {
  assert.equal(
    isUserStage({ name: 'custom', extracting: true }, ['custom']),
    false
  );
  assert.equal(
    decideDoubleClick({ name: 'custom', extracting: true }, ['custom']),
    'abort'
  );
});
