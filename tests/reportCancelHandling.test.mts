import assert from 'node:assert/strict';
import test from 'node:test';

import {
  cancelledError,
  isCancelledError,
  isCancelledResponse,
  reportApiError,
  reportErrorCode,
  watchForCancel
} from '../src/components/BugReport/reportProgressErrors.ts';
import { createReportProgressStore } from '../src/components/BugReport/reportProgressStore.ts';
import type {
  ReportProgress,
  ReportStage
} from '../src/components/BugReport/reportProgressTypes.ts';

/**
 * A report cancelled from the other app must stop the Dial's work on it: the
 * headless upload of a mobile report (dispatchedReports.ts) and the Dial's own
 * quick report (BugReport.tsx) both rely on these pieces to tell a cancel from
 * a failure.
 *
 * Regressions a user at the machine would see without it: a report the user
 * cancelled on the phone is collected and uploaded to Sentry anyway, or ends in
 * a "could not be sent" notification / a BR-01 error screen instead of
 * "Report cancelled", or is retried again and again after the 409.
 *
 * Expected values come from the backend's contract: a cancelled report answers
 * 409 with `{"error", "description", "data": {"code": "REPORT_CANCELLED"}}`
 * (espresso-api 0.15 does not list that code, so the Dial reads it from the
 * body), and the `report_progress` event says `cancelled`.
 *
 * Bug it catches that the suite misses: with espresso-api 0.15 alone,
 * getReportErrorCode() answers undefined for REPORT_CANCELLED, so the 409 looks
 * like any other error: a retry loop and a failure notification.
 */

const progress = (localID: string, stage: ReportStage): ReportProgress => ({
  v: 1,
  localID,
  origin: 'mobile',
  ticket: 7,
  stage,
  stages: ['queued', 'preparing', 'uploading'],
  detail: null,
  cancellable: stage !== 'uploading',
  final: stage === 'cancelled',
  failure: null,
  startedAt: 1,
  updatedAt: 1
});

const CANCELLED_BODY = {
  error: 'REPORT_CANCELLED',
  description: 'This report was cancelled',
  data: { code: 'REPORT_CANCELLED' }
};

test('a 409 REPORT_CANCELLED body is recognised, and other errors are not', () => {
  assert.equal(reportErrorCode(CANCELLED_BODY), 'REPORT_CANCELLED');
  assert.equal(isCancelledResponse(CANCELLED_BODY), true);

  const tooLate = {
    error: 'x',
    description: '',
    data: { code: 'TOO_LATE_TO_CANCEL' }
  };
  assert.equal(reportErrorCode(tooLate), 'TOO_LATE_TO_CANCEL');
  assert.equal(isCancelledResponse(tooLate), false);

  for (const other of [
    undefined,
    null,
    'REPORT_CANCELLED',
    { data: { code: 'REPORT_CANCELLED' } }, // not an error body: no `error`
    { error: 'Request failed', description: '' },
    { error: 'x', data: { code: 5 } },
    { localID: 'ok' }
  ]) {
    assert.equal(isCancelledResponse(other), false, JSON.stringify(other));
  }
});

test('an error built from the body keeps the code, so a retry loop can stop on it', () => {
  const error = reportApiError(CANCELLED_BODY);
  assert.equal(error.message, 'REPORT_CANCELLED');
  assert.equal(isCancelledError(error), true);
  assert.equal(isCancelledError(cancelledError()), true);
  assert.equal(isCancelledError(new Error('Network Error')), false);
  assert.equal(isCancelledError(reportApiError({ error: 'boom' })), false);
  assert.equal(isCancelledError(null), false);
});

test('work stops when the machine says the report was cancelled, once, and only for that report', () => {
  const store = createReportProgressStore();
  let stopped = 0;
  watchForCancel('mine', () => stopped++, store);

  store.apply(progress('other', 'cancelled'));
  store.apply(progress('mine', 'preparing'));
  assert.equal(stopped, 0);

  store.apply({ ...progress('mine', 'cancelled'), updatedAt: 2 });
  store.apply({ ...progress('mine', 'cancelled'), updatedAt: 3 });
  assert.equal(stopped, 1);
});

test('a report already cancelled when the work starts stops it at once', () => {
  const store = createReportProgressStore();
  store.apply(progress('mine', 'cancelled'));
  let stopped = 0;
  watchForCancel('mine', () => stopped++, store);
  assert.equal(stopped, 1);
});

test('work that finished no longer listens', () => {
  const store = createReportProgressStore();
  let stopped = 0;
  const stopWatching = watchForCancel('mine', () => stopped++, store);
  stopWatching();
  store.apply(progress('mine', 'cancelled'));
  assert.equal(stopped, 0);
});

test('the watch aborts the in-flight request the way the upload wires it', async () => {
  const store = createReportProgressStore();
  const controller = new AbortController();
  const inFlight = new Promise((_, reject) => {
    controller.signal.addEventListener('abort', () =>
      reject(new Error('aborted'))
    );
  });
  watchForCancel('mine', () => controller.abort(), store);

  store.apply(progress('mine', 'cancelled'));

  await assert.rejects(inFlight, /aborted/);
  assert.equal(controller.signal.aborted, true);
});
