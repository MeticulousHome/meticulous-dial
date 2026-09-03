import assert from 'node:assert/strict';
import test from 'node:test';

import { requestFactoryReset } from '../src/features/machineReset.ts';

const response = (status: number, body: object): Response =>
  ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body
  }) as Response;

test('factory reset uses POST on a current backend', async () => {
  const methods: string[] = [];
  const result = await requestFactoryReset(
    'http://localhost:8080/',
    async (_input, init) => {
      methods.push(init?.method ?? '');
      return response(200, { status: 'success' });
    }
  );

  assert.deepEqual(methods, ['POST']);
  assert.deepEqual(result, { status: 'success' });
});

test('factory reset falls back to legacy GET only after an explicit 405', async () => {
  const methods: string[] = [];
  const result = await requestFactoryReset(
    'http://localhost:8080',
    async (_input, init) => {
      methods.push(init?.method ?? '');
      return methods.length === 1
        ? response(405, { error: 'method_not_allowed' })
        : response(200, { status: 'success' });
    }
  );

  assert.deepEqual(methods, ['POST', 'GET']);
  assert.deepEqual(result, { status: 'success' });
});

test('factory reset does not retry other failures as GET', async () => {
  const methods: string[] = [];

  await assert.rejects(
    requestFactoryReset('http://localhost:8080', async (_input, init) => {
      methods.push(init?.method ?? '');
      return response(403, { error: 'local_access_only' });
    }),
    /local_access_only/
  );
  assert.deepEqual(methods, ['POST']);
});
