// The power save gauge (screens/settings/PowerSave.js).
// 1. Regression a user would see: turning the knob after a long press leaves "Off" on 1 min (one step below
//    an Off of 0) instead of the time they had, or the gauge offers a time ErP does not allow.
// 2. Expected values: the backend's standby_timeout contract (0 off, 1 to 20 minutes, default 15).
// 3. Not covered elsewhere: the e2e tests drive the screen but not the resume after Off without a stored time.
import assert from 'node:assert/strict';
import test from 'node:test';

import {
  isPowerSaveOff,
  label,
  legend,
  nextTimeout,
  timeoutOf,
  POWER_SAVE_DEFAULT,
  POWER_SAVE_MAX,
  POWER_SAVE_MIN,
  POWER_SAVE_OFF
} from '../src/components/PowerSave/powerSave.ts';

test('the limits are the backend standby_timeout contract', () => {
  assert.equal(POWER_SAVE_OFF, 0);
  assert.equal(POWER_SAVE_MIN, 1);
  assert.equal(POWER_SAVE_MAX, 20);
  assert.equal(POWER_SAVE_DEFAULT, 15);
});

test('the knob steps a minute and stays within 1 to 20', () => {
  assert.equal(nextTimeout(10, 10, 'right'), 11);
  assert.equal(nextTimeout(10, 10, 'left'), 9);
  assert.equal(nextTimeout(POWER_SAVE_MAX, null, 'right'), POWER_SAVE_MAX);
  assert.equal(nextTimeout(POWER_SAVE_MIN, null, 'left'), POWER_SAVE_MIN);
});

test('turning the knob out of Off brings back the last time, or the default', () => {
  assert.equal(nextTimeout(POWER_SAVE_OFF, 7, 'left'), 7);
  assert.equal(nextTimeout(POWER_SAVE_OFF, 7, 'right'), 7);
  assert.equal(nextTimeout(POWER_SAVE_OFF, null, 'right'), POWER_SAVE_DEFAULT);
  assert.equal(nextTimeout(POWER_SAVE_OFF, undefined, 'left'), POWER_SAVE_DEFAULT);
});

test('the stored timeout, or the default on a backend without power save', () => {
  assert.equal(timeoutOf({ standby_timeout: 0 }), 0);
  assert.equal(timeoutOf({ standby_timeout: 12 }), 12);
  assert.equal(timeoutOf({}), POWER_SAVE_DEFAULT);
  assert.equal(timeoutOf(null), POWER_SAVE_DEFAULT);
});

test('labels and legend say Off, or the time and the preheat note', () => {
  assert.equal(isPowerSaveOff(0), true);
  assert.equal(isPowerSaveOff(5), false);
  assert.equal(label(0), 'Off');
  assert.equal(label(15), '15 min');
  assert.deepEqual(legend(0), ['Rotate knob to set the time', 'Click to save']);
  assert.deepEqual(legend(15), ['Long press turns power save off', 'Power save may override the preheat', 'Click to save']);
});
