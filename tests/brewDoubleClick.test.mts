import assert from 'node:assert/strict';
import test from 'node:test';

import {
  decideDoubleClick,
  isUserStage
} from '../src/hooks/brewDoubleClick.ts';
import { MACHINE_OWNED_STAGES } from '../src/constants/setting.ts';

// The barometer is the only screen that passes allowFinish.
const barometer = { allowFinish: true };
const otherBrewScreen = { allowFinish: false };

test('idle is never acted on, even if extracting is somehow true', () => {
  assert.equal(
    decideDoubleClick({ name: 'idle', extracting: false }, barometer),
    null
  );
  assert.equal(
    decideDoubleClick({ name: 'idle', extracting: true }, barometer),
    null
  );
  assert.equal(
    decideDoubleClick({ name: 'idle', extracting: false }, otherBrewScreen),
    null
  );
  assert.equal(
    decideDoubleClick({ name: 'idle', extracting: true }, otherBrewScreen),
    null
  );
});

test('every machine-owned stage aborts while extracting, on every screen', () => {
  for (const name of MACHINE_OWNED_STAGES) {
    const expected = name === 'idle' ? null : 'abort';
    assert.equal(
      decideDoubleClick({ name, extracting: true }, barometer),
      expected,
      `${name} while extracting on the barometer`
    );
    assert.equal(
      decideDoubleClick({ name, extracting: true }, otherBrewScreen),
      expected,
      `${name} while extracting on a non-finishing brew screen`
    );
  }
});

test('the final retract aborts rather than finishing', () => {
  // `extracting` is still true here, so only the name keeps this out of
  // the user-stage branch.
  assert.equal(
    decideDoubleClick({ name: 'retracting', extracting: true }, barometer),
    'abort'
  );
});

test('machine-owned stages abort when not extracting', () => {
  assert.equal(
    decideDoubleClick({ name: 'heating', extracting: false }, barometer),
    'abort'
  );
  assert.equal(
    decideDoubleClick({ name: 'click to start', extracting: false }, barometer),
    'abort'
  );
});

test('a profile stage finishes on the barometer only while extracting', () => {
  assert.equal(
    decideDoubleClick({ name: 'Pre-infusion', extracting: true }, barometer),
    'finish'
  );
  assert.equal(
    decideDoubleClick({ name: 'Pre-infusion', extracting: false }, barometer),
    'abort'
  );
});

test('a user stage aborts on a screen that may not finish', () => {
  // Heating, brew-complete and purge: the same status that finishes on the
  // barometer can only abort here.
  assert.equal(
    decideDoubleClick(
      { name: 'Pre-infusion', extracting: true },
      otherBrewScreen
    ),
    'abort'
  );
  assert.equal(
    decideDoubleClick(
      { name: 'Pre-infusion', extracting: false },
      otherBrewScreen
    ),
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
    decideDoubleClick(
      { name: 'custom', extracting: true },
      { allowFinish: true, machineOwnedStages: ['custom'] }
    ),
    'abort'
  );
  assert.equal(
    decideDoubleClick(
      { name: 'custom', extracting: true },
      { allowFinish: true, machineOwnedStages: ['other'] }
    ),
    'finish'
  );
});
