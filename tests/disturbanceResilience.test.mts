// Disturbance resilience: config menu item and its full screen.
//
// 1. Regression a user at the machine would see: when the machine refuses the
//    save (old firmware, ESP NVS write failed, timeout), the screen must stay
//    and surface the backend's reason. Before, every refused setting reached
//    the Dial as "Network error while updating settings.", because the
//    espresso-api client resolves HTTP 400 and the error thrown from its body
//    was re-caught as a network error.
// 2. Expected values: the backend contract for POST /api/v1/settings
//    (HTTP 400 `{"status": "error", "error": "<message>"}`, messages quoted
//    verbatim), the espresso-api client accepting 400 (validateStatus), the
//    setting's default (off when absent), and the screen copy and menu label
//    from the product spec, quoted verbatim.
// 3. Restoring the old updateSettings catch block fails the first test; the
//    suite had no test of settings saves before.
import assert from 'node:assert/strict';
import test from 'node:test';

import {
  applySettingsUpdate,
  SETTINGS_UPDATE_NETWORK_ERROR
} from '../src/api/settingsUpdate.ts';
import {
  DISTURBANCE_RESILIENCE_OPTIONS,
  disturbanceResilienceCopy,
  DISTURBANCE_RESILIENCE_LABEL,
  initialDisturbanceResilienceIndex,
  showDisturbanceResilience
} from '../src/utils/disturbanceResilience.ts';

const quiet = (t: {
  mock: { method: (o: object, m: string, impl: () => void) => void };
}) => t.mock.method(console, 'error', () => {});

test('a setting the backend refuses (HTTP 400 body) rejects with its message', async (t) => {
  quiet(t);
  const message = 'failed to save disturbance_resilience on the machine: ERROR';
  await assert.rejects(
    applySettingsUpdate(
      async () => ({ data: { status: 'error', error: message } }),
      { disturbance_resilience: true }
    ),
    { message }
  );
});

test('a thrown HTTP error keeps the backend message', async (t) => {
  quiet(t);
  const message =
    'disturbance_resilience is not supported by the machine firmware';
  await assert.rejects(
    applySettingsUpdate(
      async () => {
        throw Object.assign(new Error('Request failed'), {
          response: { data: { status: 'error', error: message } }
        });
      },
      { disturbance_resilience: true }
    ),
    { message }
  );
});

test('no response at all is a network error', async (t) => {
  quiet(t);
  await assert.rejects(
    applySettingsUpdate(
      async () => {
        throw new Error('connect ECONNREFUSED');
      },
      { disturbance_resilience: false }
    ),
    { message: SETTINGS_UPDATE_NETWORK_ERROR }
  );
});

test('a confirmed save returns the settings the backend sent', async () => {
  const saved = { disturbance_resilience: true, auto_purge_after_shot: false };
  assert.deepEqual(
    await applySettingsUpdate(async () => ({ data: saved }), {
      disturbance_resilience: true
    }),
    saved
  );
});

test('the config item is the plain label, with no value to cut after a colon', () => {
  assert.equal(DISTURBANCE_RESILIENCE_LABEL, 'disturbance resilience');
});

test('the screen has a Disabled and an Enabled pill saving false and true', () => {
  assert.deepEqual(
    DISTURBANCE_RESILIENCE_OPTIONS.map(({ label, value }) => [label, value]),
    [
      ['Disabled', false],
      ['Enabled', true]
    ]
  );
});

test('the screen opens focused on the stored value, Disabled when unknown', () => {
  const label = (settings?: { disturbance_resilience?: boolean }) =>
    DISTURBANCE_RESILIENCE_OPTIONS[initialDisturbanceResilienceIndex(settings)]
      .label;
  assert.equal(label({ disturbance_resilience: true }), 'Enabled');
  assert.equal(label({ disturbance_resilience: false }), 'Disabled');
  assert.equal(label({}), 'Disabled');
  assert.equal(label(undefined), 'Disabled');
});

test('the copy follows the focused pill', () => {
  const disabled =
    'The machine will prioritize the weight target over scale disturbances.';
  const enabled =
    'The machine will prioritize ignoring scale disturbances over the weight target.';
  assert.equal(disturbanceResilienceCopy(0), disabled);
  assert.equal(disturbanceResilienceCopy(1), enabled);
});

test('the item is hidden only when the machine says it is unsupported', () => {
  assert.equal(
    showDisturbanceResilience({ disturbance_resilience_supported: false }),
    false
  );
  assert.equal(
    showDisturbanceResilience({ disturbance_resilience_supported: true }),
    true
  );
  // Older backend or machine info not loaded yet: rely on the error path.
  assert.equal(showDisturbanceResilience({}), true);
  assert.equal(showDisturbanceResilience(undefined), true);
});
