import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ApiModule from '@meticulous-home/espresso-api';

import {
  appendKeyboardCharacter,
  appendKeyboardSpace,
  canSubmitKeyboardCaption,
  DEFAULT_KEYBOARD_INPUT_LIMIT,
  KEYBOARD_PUNCTUATION,
  serializeKeyboardCaption
} from '../src/components/CircleKeyboard/input.ts';
import { buildWifiConnectCredentials } from '../src/components/Wifi/credentials.ts';

const EXPECTED_ASCII_PUNCTUATION = [
  ...`!"#$%&'()*+,-./:;<=>?@[\\]^_\`{|}~`
].sort();
const Api = ApiModule.default;

test('caret remains in the displayed and submitted password', () => {
  const caption = appendKeyboardCharacter([...'Coffee123'], '^');

  assert.equal(caption.at(-1), '^');
  assert.equal(serializeKeyboardCaption(caption, false), 'Coffee123^');
});

test('every keyboard punctuation character survives an exact round trip', () => {
  let caption = [];
  for (const character of KEYBOARD_PUNCTUATION) {
    caption = appendKeyboardCharacter(caption, character);
  }

  assert.equal(
    serializeKeyboardCaption(caption, false),
    KEYBOARD_PUNCTUATION.join('')
  );
});

test('the Wi-Fi keyboard exposes every printable ASCII punctuation character', () => {
  assert.deepEqual(
    [...KEYBOARD_PUNCTUATION].sort(),
    EXPECTED_ASCII_PUNCTUATION
  );
});

test('Wi-Fi serialization does not alter leading or trailing characters', () => {
  const caption = [...' ^Coffee123^ '];

  assert.equal(serializeKeyboardCaption(caption, false), ' ^Coffee123^ ');
  assert.equal(serializeKeyboardCaption(caption), '^Coffee123^');
});

test('input remains bounded at the machine keyboard limit', () => {
  const fullCaption = Array(DEFAULT_KEYBOARD_INPUT_LIMIT).fill('a');
  const result = appendKeyboardCharacter(fullCaption, '^');

  assert.deepEqual(result, fullCaption);
  assert.notEqual(result, fullCaption);
});

test('Wi-Fi entry accepts leading, trailing, and all-space passphrases exactly', () => {
  const leadingSpace = appendKeyboardSpace(
    [],
    DEFAULT_KEYBOARD_INPUT_LIMIT,
    true
  );
  const trailingSpace = appendKeyboardSpace(
    [...'Coffee123'],
    DEFAULT_KEYBOARD_INPUT_LIMIT,
    true
  );
  const allSpaces = Array(8).fill(' ');

  assert.equal(serializeKeyboardCaption(leadingSpace, false), ' ');
  assert.equal(serializeKeyboardCaption(trailingSpace, false), 'Coffee123 ');
  assert.equal(canSubmitKeyboardCaption(allSpaces, false), true);
  assert.equal(canSubmitKeyboardCaption(allSpaces), false);
});

test('space can occupy the final keyboard position without exceeding the limit', () => {
  const nearlyFullCaption = Array(DEFAULT_KEYBOARD_INPUT_LIMIT - 1).fill('a');
  const fullCaption = appendKeyboardSpace(
    nearlyFullCaption,
    DEFAULT_KEYBOARD_INPUT_LIMIT,
    true
  );

  assert.equal(fullCaption.length, DEFAULT_KEYBOARD_INPUT_LIMIT);
  assert.equal(fullCaption.at(-1), ' ');
  assert.equal(
    appendKeyboardSpace(fullCaption, DEFAULT_KEYBOARD_INPUT_LIMIT, true).length,
    DEFAULT_KEYBOARD_INPUT_LIMIT
  );
});

test('Wi-Fi credentials and JSON serialization preserve the password byte-for-byte', () => {
  const ssid = 'Test Network';
  const password = ` ^\\"'&;$|\`~ Coffee 123 `;
  const credentials = buildWifiConnectCredentials(ssid, password);

  assert.deepEqual(credentials, { type: 'PSK', ssid, password });
  assert.deepEqual(JSON.parse(JSON.stringify(credentials)), credentials);
});

test('the production API client posts the exact password as JSON', async () => {
  const password = ` ^\\"'&;$|\`~ Coffee 123 `;
  const credentials = buildWifiConnectCredentials('Test Network', password);
  const client = new Api(undefined, 'http://test.invalid');
  let request;

  client.axiosInstance.defaults.adapter = async (config) => {
    request = config;
    return {
      data: { status: 'ok' },
      status: 200,
      statusText: 'OK',
      headers: {},
      config
    };
  };

  await client.connectToWiFi(credentials);

  assert.equal(request.url, '/api/v1/wifi/connect');
  assert.equal(request.method, 'post');
  assert.equal(request.headers['Content-Type'], 'application/json');
  assert.deepEqual(JSON.parse(request.data), credentials);
  assert.equal(JSON.parse(request.data).password, password);
});

test('the password-entry screen cannot directly write credentials to a console logger', () => {
  const source = readFileSync(
    new URL('../src/components/Wifi/EnterWifiPassword.tsx', import.meta.url),
    'utf8'
  );

  assert.doesNotMatch(source, /\bconsole\s*\./);
  assert.doesNotMatch(source, /@tauri-apps\/plugin-log/);
});
