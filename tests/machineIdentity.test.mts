import assert from 'node:assert/strict';
import test from 'node:test';

import {
  formatMachineFingerprint,
  requestMachineIdentityRotation,
  RESET_MACHINE_IDENTITY_DEFAULT_INDEX,
  RESET_MACHINE_IDENTITY_OPTIONS
} from '../src/features/machineIdentity.ts';

test('formats the display-only identity fingerprint', () => {
  assert.equal(
    formatMachineFingerprint('abcdef0123456789'.repeat(4)),
    'ABCD-EF01'
  );
  assert.equal(formatMachineFingerprint('too-short'), null);
  assert.equal(formatMachineFingerprint(undefined), null);
});

test('the destructive confirmation defaults to Cancel', () => {
  assert.equal(
    RESET_MACHINE_IDENTITY_OPTIONS[RESET_MACHINE_IDENTITY_DEFAULT_INDEX].key,
    'cancel'
  );
});

test('identity rotation uses the loopback POST endpoint with confirmation', async () => {
  const calls: Array<{ input: RequestInfo | URL; init?: RequestInit }> = [];
  const response = {
    ok: true,
    status: 200,
    json: async () => ({
      status: 'success',
      fingerprint: 'abcdef0123456789'.repeat(4),
      generation: 2
    })
  } as Response;

  const result = await requestMachineIdentityRotation(
    'http://localhost:8080/',
    async (input, init) => {
      calls.push({ input, init });
      return response;
    }
  );

  assert.equal(calls.length, 1);
  assert.equal(
    calls[0].input,
    'http://localhost:8080/api/v1/identity/rotate?confirm=true'
  );
  assert.equal(calls[0].init?.method, 'POST');
  assert.equal(result.generation, 2);
});

test('identity rotation surfaces a backend rejection', async () => {
  const response = {
    ok: false,
    status: 403,
    json: async () => ({ error: 'local_access_only' })
  } as Response;

  await assert.rejects(
    requestMachineIdentityRotation('http://machine', async () => response),
    /local_access_only/
  );
});
