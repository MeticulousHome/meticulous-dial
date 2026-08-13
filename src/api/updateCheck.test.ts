import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createUpdateCheck,
  createUpdateCheckFeedback,
  getUpdateCheckLabel,
  UPDATE_CHECK_FEEDBACK_DURATION_MS,
  UPDATE_CHECK_LABEL,
  type UpdateCheckFeedback
} from './updateCheck.ts';

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
    return new Response(null, { status: 200 });
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

test('maps HTTP 429 to cooldown without exposing backend details', async () => {
  const result = await createUpdateCheck(
    apiUrl,
    async () => new Response('sensitive backend details', { status: 429 })
  )();

  assert.equal(result, 'cooldown');
  assert.equal(getUpdateCheckLabel(result), 'Update check available later');
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
  resolveRequest?.(new Response(null, { status: 200 }));
  assert.equal(await firstRequest, 'accepted');
});

test('resets completed feedback to the original label after five seconds', () => {
  const feedbackChanges: UpdateCheckFeedback[] = [];
  const timeoutHandle = {} as ReturnType<typeof setTimeout>;
  let scheduledDelay = 0;
  let scheduledCallback: (() => void) | undefined;
  const feedback = createUpdateCheckFeedback(
    (value) => feedbackChanges.push(value),
    (callback, delay) => {
      scheduledCallback = callback;
      scheduledDelay = delay;
      return timeoutHandle;
    }
  );

  feedback.pending();
  feedback.completed('accepted');

  assert.equal(scheduledDelay, UPDATE_CHECK_FEEDBACK_DURATION_MS);
  assert.equal(
    getUpdateCheckLabel(feedbackChanges[feedbackChanges.length - 1]),
    'Update check requested'
  );

  scheduledCallback?.();

  assert.equal(feedbackChanges[feedbackChanges.length - 1], 'idle');
  assert.equal(
    getUpdateCheckLabel(feedbackChanges[feedbackChanges.length - 1]),
    UPDATE_CHECK_LABEL
  );
  assert.equal(UPDATE_CHECK_LABEL, 'Check for updates');
});

test('cancels completed feedback reset on a subsequent request and dispose', () => {
  const cancelledHandles: ReturnType<typeof setTimeout>[] = [];
  const firstHandle = { id: 1 } as unknown as ReturnType<typeof setTimeout>;
  const secondHandle = { id: 2 } as unknown as ReturnType<typeof setTimeout>;
  const handles = [firstHandle, secondHandle];
  const feedback = createUpdateCheckFeedback(
    () => undefined,
    () => handles.shift()!,
    (handle) => cancelledHandles.push(handle)
  );

  feedback.completed('accepted');
  feedback.pending();
  feedback.completed('failed');
  feedback.dispose();

  assert.deepEqual(cancelledHandles, [firstHandle, secondHandle]);
});
