// Disturbance resilience in advanced settings.
//
// 1. Regression a user at the machine would see: when the machine refuses the
//    save (old firmware, ESP NVS write failed, timeout), the Dial must keep the
//    old value and surface the backend's reason. Before, every refused setting
//    reached the Dial as "Network error while updating settings.", because the
//    espresso-api client resolves HTTP 400 and the error thrown from its body
//    was re-caught as a network error. The label must also never show the new
//    value before the backend confirmed it.
// 2. Expected values: the backend contract for POST /api/v1/settings
//    (HTTP 400 `{"status": "error", "error": "<message>"}`, messages quoted
//    verbatim), the espresso-api client accepting 400 (validateStatus), and
//    the setting's default (off when absent); labels from disturbanceResilience.ts.
// 3. Restoring the old updateSettings catch block fails the first test; the
//    suite had no test of settings saves before.
import assert from 'node:assert/strict';
import test from 'node:test';

import {
  applySettingsUpdate,
  SETTINGS_UPDATE_NETWORK_ERROR
} from '../src/api/settingsUpdate.ts';
import {
  DISTURBANCE_RESILIENCE_LABEL,
  disturbanceResilienceLabel,
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

test('the label shows only the confirmed value, off when absent', () => {
  const off = `${DISTURBANCE_RESILIENCE_LABEL}: DISABLED`;
  const on = `${DISTURBANCE_RESILIENCE_LABEL}: ENABLED`;
  assert.equal(disturbanceResilienceLabel({ settings: {} }), off);
  assert.equal(disturbanceResilienceLabel({ settings: undefined }), off);
  assert.equal(
    disturbanceResilienceLabel({
      settings: { disturbance_resilience: true }
    }),
    on
  );
  // Switching on is in flight or was refused: still the old value.
  assert.equal(
    disturbanceResilienceLabel({ settings: {}, saving: true }),
    `${off} (saving)`
  );
  assert.equal(
    disturbanceResilienceLabel({ settings: {}, failed: true }),
    `${off} (not saved)`
  );
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
