import assert from 'node:assert/strict';
import test from 'node:test';

import {
  holdRun,
  reportHandoff
} from '../src/components/BugReport/reportHandoff.ts';

/**
 * A report filed with no contact email on file closes the bug report bubble
 * for the contact email screen while the machine collects, and a new bubble
 * takes the collection run when the screen is done.
 *
 * Regression at the machine: the report is sent twice, two tickets and two
 * feedbacks, the first without the email the user typed. That happens when
 * POST /reports/create answers while the closing bubble still plays its exit
 * animation, if that bubble keeps acting on the run.
 *
 * Expected value: one report, sent once, by the bubble that came back (the
 * one that has the user's answer). The journey "a report without an email
 * creates the report and sends only its id" asserts the same at the backend.
 */

const DRAFT = { draft: { localID: 'draft-1', machineID: 'machine-1' } };

const deferredRun = () => {
  let settle: (outcome: unknown) => void = () => {};
  const run = {
    cancelled: false,
    controller: new AbortController(),
    slow: false,
    onSlow: null,
    outcome: new Promise((resolve) => {
      settle = resolve;
    })
  };
  return { run, settle };
};

const flush = () => new Promise((resolve) => setImmediate(resolve));

test('create answering while the closing bubble animates out is sent once, by the bubble that comes back', async () => {
  const { run, settle } = deferredRun();
  const acted: [string, unknown][] = [];
  const closing = { current: null };
  holdRun(closing, run, (outcome) => acted.push(['closing', outcome]));

  reportHandoff.detach(closing);
  settle(DRAFT);
  await flush();
  assert.deepEqual(acted, [], 'nothing is sent while the run is handed over');
  assert.equal(
    closing.current,
    null,
    'the closing bubble no longer holds the run, so its unmount cannot cancel it'
  );

  const back = { current: null };
  const taken = reportHandoff.takeRun();
  assert.equal(taken, run);
  holdRun(back, taken, (outcome) => acted.push(['back', outcome]));
  await flush();

  assert.deepEqual(acted, [['back', DRAFT]]);
});

test('create answering after the bubble came back is sent once, by that bubble', async () => {
  const { run, settle } = deferredRun();
  const acted: [string, unknown][] = [];
  const closing = { current: null };
  holdRun(closing, run, (outcome) => acted.push(['closing', outcome]));
  reportHandoff.detach(closing);

  const back = { current: null };
  const taken = reportHandoff.takeRun();
  assert.equal(taken, run);
  holdRun(back, taken, (outcome) => acted.push(['back', outcome]));
  settle(DRAFT);
  await flush();

  assert.deepEqual(acted, [['back', DRAFT]]);
});
