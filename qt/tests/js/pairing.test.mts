// What "Pair a device" shows for each answer of POST /api/v1/auth/pairing?mode=new
// (qt/qml/Dial/screens/settings/Pairing.js).
//
// Regression a user at the machine would see without it: a code drawn as one unreadable block instead of
// ABCD-EFGH, a countdown that skips or reads 9:60, a screen stuck on "Creating a pairing code..." or a QR
// code of nothing after a broken answer, no way to get a new code once one expired, and a generic failure
// (instead of "does not support pairing yet") on a machine whose backend predates device authorization.
// Expected values come from the device authorization contract shared with meticulous-backend: codes are 8
// characters of Crockford base32 (0-9 and A-Z without I, L, O, U), shown as ABCD-EFGH, valid `expires_in`
// seconds (600); `pair_url` is what the QR carries; a backend without /api/v1/auth answers 404.
// The suite missed it: there was no pairing screen, and the smoke test only opens it without a backend.
import assert from 'node:assert/strict';
import test from 'node:test';

import {
  actions, afterTick, countdownText, displayCode, fromAnswer, fromError, hintText, isCode, placeholderText,
  secondsLeft, UNSUPPORTED_TEXT,
} from '../../qml/Dial/screens/settings/Pairing.js';

const answer = { code: 'K7Q2M9XZ', pair_url: 'http://192.168.1.20/#pair=K7Q2M9XZ', expires_in: 600 };

test('a code is shown in two groups of four', () => {
  assert.equal(displayCode('K7Q2M9XZ'), 'K7Q2-M9XZ');
  assert.equal(displayCode('00000000'), '0000-0000');
});

test('only a canonical code is a code', () => {
  assert.equal(isCode('ABCDEFGH'), true);
  // The letters Crockford base32 leaves out, lower case, a separator, the wrong length, not a string.
  for (const bad of ['ABCDEFGI', 'ABCDEFGL', 'ABCDEFGO', 'ABCDEFGU', 'abcdefgh', 'ABCD-EFG', 'ABCDEFG',
    'ABCDEFGHJ', '', null, undefined, 12345678]) {
    assert.equal(isCode(bad), false, String(bad));
    assert.equal(displayCode(bad), '');
  }
});

test('the countdown starts at the full lifetime and reaches zero when the code expires', () => {
  assert.equal(secondsLeft(600, 0), 600);
  assert.equal(countdownText(secondsLeft(600, 0)), '10:00');
  assert.equal(secondsLeft(600, 1), 600);
  assert.equal(secondsLeft(600, 1000), 599);
  assert.equal(countdownText(secondsLeft(600, 1000)), '9:59');
  assert.equal(countdownText(secondsLeft(600, 595_000)), '0:05');
  assert.equal(secondsLeft(600, 599_001), 1);
  assert.equal(secondsLeft(600, 600_000), 0);
  assert.equal(secondsLeft(600, 3_600_000), 0);
  // No lifetime, or garbage, is already expired; a negative elapsed time does not add time.
  assert.equal(secondsLeft(0, 0), 0);
  assert.equal(secondsLeft(undefined, 0), 0);
  assert.equal(secondsLeft(600, -5000), 600);
});

test('the countdown text pads the seconds', () => {
  assert.equal(countdownText(0), '0:00');
  assert.equal(countdownText(9), '0:09');
  assert.equal(countdownText(61), '1:01');
  assert.equal(countdownText(125), '2:05');
  assert.equal(countdownText(-3), '0:00');
});

test('a complete answer shows the QR code of its pair URL', () => {
  assert.deepEqual(fromAnswer(answer), {
    state: 'ready', code: 'K7Q2M9XZ', pairUrl: 'http://192.168.1.20/#pair=K7Q2M9XZ', expiresIn: 600,
  });
});

test('an answer without a usable code, URL or lifetime is a failure, not an empty QR code', () => {
  for (const bad of [null, '', 'ok', {}, { ...answer, code: 'ABCD-EFGH' }, { ...answer, code: undefined },
    { ...answer, pair_url: '' }, { ...answer, pair_url: undefined }, { ...answer, expires_in: 0 },
    { ...answer, expires_in: 'soon' }]) {
    assert.deepEqual(fromAnswer(bad), { state: 'failed' }, JSON.stringify(bad));
  }
});

test('a backend without pairing (404) says so; any other failure offers a new code', () => {
  assert.deepEqual(fromError({ status: 404, data: null, message: 'HTTP 404' }), { state: 'unsupported' });
  assert.equal(placeholderText('unsupported'), UNSUPPORTED_TEXT);
  assert.equal(UNSUPPORTED_TEXT, "This machine's software does not support pairing yet");
  assert.deepEqual(actions('unsupported'), ['Back']);
  // No answer (the smoke test, a backend restarting), a refusal, a server error.
  for (const status of [0, 403, 500]) {
    assert.deepEqual(fromError({ status, data: null, message: '' }), { state: 'failed' });
  }
  assert.deepEqual(fromError(undefined), { state: 'failed' });
  assert.deepEqual(actions('failed'), ['New code', 'Back']);
});

test('a ready code expires at zero and then offers a new one', () => {
  assert.equal(afterTick('ready', 1), 'ready');
  assert.equal(afterTick('ready', 0), 'expired');
  assert.deepEqual(actions('ready'), ['Back']);
  assert.deepEqual(actions('expired'), ['New code', 'Back']);
  // The other states do not change with time.
  for (const state of ['loading', 'failed', 'unsupported', 'expired']) assert.equal(afterTick(state, 0), state);
});

test('the hint under the code counts down while it is ready', () => {
  assert.equal(hintText('ready', 125), 'Expires in 2:05');
  assert.equal(hintText('expired', 0), 'Choose New code to try again.');
  assert.equal(hintText('unsupported', 0), '');
  assert.equal(placeholderText('ready'), '');
});
