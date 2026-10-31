// Disturbance resilience in config and its screen (qt/qml/Dial/screens/settings/DisturbanceResilience.js).
//
// Regressions a user at the machine would see without it:
//  - the item reads ENABLED, or the screen opens on "Enabled", on a machine whose backend has it off or has
//    not sent the setting yet (an older backend): the contract says off by default;
//  - the copy under the pills says the opposite of what the focused choice does (Disabled keeps the weight
//    target, Enabled ignores scale disturbances), or a pill saves the other value;
//  - the item disappears on a machine whose firmware supports it, or whose device info is not in yet,
//    instead of only when the machine reports disturbance_resilience_supported: false;
//  - a refused save logs nothing useful: the backend's 400 message ({ status: "error", error }) is lost.
// Expected values come from the cross-repo contract (backend setting `disturbance_resilience`, default false;
// `/api/v1/machine` field `disturbance_resilience_supported`; the 400 body of POST /api/v1/settings) and from
// the shapes Core/Api.qml (`{ status, data, message }`) and Core/BackendSettings.qml (`Error`) reject with.
import assert from 'node:assert/strict';
import test from 'node:test';

import {
  SETTING_KEY,
  LABEL,
  TITLE,
  CHOICES,
  errorMessage,
  initialIndex,
  isAvailable,
  isEnabled
} from '../../qml/Dial/screens/settings/DisturbanceResilience.js';

test('uses the backend setting key and the contract copy', () => {
  assert.equal(SETTING_KEY, 'disturbance_resilience');
  assert.equal(LABEL, 'disturbance resilience');
  assert.equal(TITLE, 'Disturbance resilience');
});

test('offers Disabled then Enabled, each saving its value with its own copy', () => {
  assert.deepEqual(CHOICES.map((c) => [c.label, c.value]), [['Disabled', false], ['Enabled', true]]);
  assert.equal(CHOICES[0].copy,
    'The machine will prioritize the weight target over scale disturbances.');
  assert.equal(CHOICES[1].copy,
    'The machine will prioritize ignoring scale disturbances over the weight target.');
});

test('opens on the stored choice, Disabled while unknown', () => {
  assert.equal(initialIndex({ disturbance_resilience: true }), 1);
  assert.equal(initialIndex({ disturbance_resilience: false }), 0);
  assert.equal(initialIndex(null), 0);
});

test('shows the value the backend has, off when absent or unknown', () => {
  assert.equal(isEnabled({ disturbance_resilience: true }), true);
  assert.equal(isEnabled({ disturbance_resilience: false }), false);
  assert.equal(isEnabled({ ssh_enabled: true }), false);
  assert.equal(isEnabled(null), false);
  // Only a real boolean true counts: a stray string from a bad config is not "on".
  assert.equal(isEnabled({ disturbance_resilience: 'false' }), false);
});

test('is hidden only when the machine reports its firmware cannot store it', () => {
  assert.equal(isAvailable({ disturbance_resilience_supported: false }), false);
  assert.equal(isAvailable({ disturbance_resilience_supported: true }), true);
  // An older backend without the field, and no device info yet: shown, a refusal takes the error path.
  assert.equal(isAvailable({ tare_behavior_supported: true }), true);
  assert.equal(isAvailable(null), true);
});

test('takes the backend message of a refused save', () => {
  const unsupported = 'disturbance_resilience is not supported by the machine firmware';
  assert.equal(
    errorMessage({ status: 400, data: { status: 'error', error: unsupported }, message: unsupported }),
    unsupported
  );
  assert.equal(errorMessage(new Error('failed to save disturbance_resilience on the machine: ERROR')),
    'failed to save disturbance_resilience on the machine: ERROR');
  assert.equal(errorMessage({ status: 0, data: null, message: 'HTTP 0 POST /api/v1/settings/' }),
    'HTTP 0 POST /api/v1/settings/');
  assert.equal(errorMessage(undefined), 'unknown error');
});
