import assert from 'node:assert/strict';
import test from 'node:test';

import { createUpdateCheck } from './updateCheck.ts';

const apiUrl = 'http://backend.example';

test('posts a manual update check through the configured API URL', async () => {
  let requestedUrl = '';
  let requestedMethod = '';
  const fetchRequest = async (
    url: string | URL | Request,
    init?: RequestInit
  ) => {
    requestedUrl = String(url);
    requestedMethod = init?.method ?? '';
    return new Response(null, { status: 202 });
  };

  const result = await createUpdateCheck(apiUrl, fetchRequest)();

  assert.equal(requestedUrl, `${apiUrl}/api/v1/update/check`);
  assert.equal(requestedMethod, 'POST');
  assert.equal(result, 'accepted');
});

test('maps HTTP 409 to an active update', async () => {
  const result = await createUpdateCheck(
    apiUrl,
    async () => new Response('backend details', { status: 409 })
  )();

  assert.equal(result, 'update-active');
});

test('maps a generic non-2xx response to failure', async () => {
  const result = await createUpdateCheck(
    apiUrl,
    async () => new Response('backend details', { status: 503 })
  )();

  assert.equal(result, 'failed');
});

test('maps a network error to failure', async () => {
  const result = await createUpdateCheck(apiUrl, async () => {
    throw new Error('network details');
  })();

  assert.equal(result, 'failed');
});

test('reuses the pending request instead of issuing another POST', async () => {
  let requestCount = 0;
  let resolveRequest: ((response: Response) => void) | undefined;
  const checkForUpdates = createUpdateCheck(apiUrl, () => {
    requestCount += 1;
    return new Promise<Response>((resolve) => {
      resolveRequest = resolve;
    });
  });

  const firstRequest = checkForUpdates();
  const secondRequest = checkForUpdates();

  assert.equal(requestCount, 1);
  assert.equal(firstRequest, secondRequest);
  resolveRequest?.(new Response(null, { status: 202 }));
  assert.equal(await firstRequest, 'accepted');
});
