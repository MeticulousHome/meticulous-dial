import assert from 'node:assert/strict';
import test from 'node:test';

import {
  clampIndex,
  detailLabel,
  finalLabel,
  segmentsFor,
  stageLabel,
  STAGE_LABELS,
  ticketLabel,
  UNKNOWN_STAGE_LABEL
} from '../src/components/BugReport/reportProgressView.ts';
import type {
  ReportProgress,
  ReportStage
} from '../src/components/BugReport/reportProgressTypes.ts';

/**
 * What the progress view of the bug report bubble draws for a report: the
 * stage label, the segmented indicator, the `3/10` detail, the ticket and the
 * closing label, and the cursor staying on the option list.
 *
 * Regressions a user at the machine would see without it: a wrong or missing
 * stage text ("undefined"), an indicator that marks the wrong step as current
 * or that draws a fixed list instead of the stages of the report (a dial report
 * has no `queued`, a mobile one has no `ticketing`), a finished report drawn as
 * running, a crash on a stage a newer backend adds.
 *
 * Expected values come from the contract: the labels table (the same words as
 * the mobile app), `stages` as the only source of segments, the final labels
 * "Report sent" / "Report cancelled" / "Report failed (<failure.code>)", and
 * the rule that clients draw unknown stages as a generic step.
 * The cursor rule is the bubble's own: an option list that shrinks (Cancel goes
 * away at uploading, the report ends) must leave the cursor on an option, or
 * nothing is highlighted and a push does nothing.
 *
 * Bug it catches that the suite misses: none of this was covered, so a label
 * typo or an off-by-one in the current segment would only show on the display.
 */

const DIAL_STAGES: ReportStage[] = [
  'preparing',
  'fetching_machine_info',
  'fetching_logs',
  'fetching_machine_status',
  'collecting_debug_shots',
  'ticketing',
  'compressing',
  'uploading',
  'finishing'
];
const MOBILE_STAGES: ReportStage[] = [
  'queued',
  ...DIAL_STAGES.filter((stage) => stage !== 'ticketing')
];

const report = (
  stage: ReportStage | string,
  extra: Partial<ReportProgress> = {}
): ReportProgress => ({
  v: 1,
  localID: 'r',
  origin: 'dial',
  ticket: null,
  stage: stage as ReportStage,
  stages: DIAL_STAGES,
  detail: null,
  cancellable: true,
  final: ['submitted', 'failed', 'cancelled'].includes(stage),
  failure: null,
  startedAt: 1,
  updatedAt: 1,
  ...extra
});

test('every stage reads as the contract says', () => {
  const expected: Record<string, string> = {
    queued: 'Waiting for the machine',
    preparing: 'Preparing',
    fetching_machine_info: 'Fetching machine info',
    fetching_logs: 'Fetching logs',
    fetching_machine_status: 'Fetching machine status',
    collecting_debug_shots: 'Collecting debug shots',
    ticketing: 'Getting a ticket number',
    compressing: 'Compressing',
    uploading: 'Uploading',
    finishing: 'Finishing',
    submitted: 'Report sent',
    failed: 'Report failed',
    cancelled: 'Report cancelled'
  };
  assert.deepEqual({ ...STAGE_LABELS }, expected);
  for (const [stage, label] of Object.entries(expected)) {
    assert.equal(stageLabel(stage), label);
  }
});

test('a stage the Dial does not know gets a generic label, never undefined or a crash', () => {
  assert.equal(stageLabel('a_stage_from_the_future'), UNKNOWN_STAGE_LABEL);
  assert.equal(stageLabel('toString'), UNKNOWN_STAGE_LABEL);
  assert.equal(stageLabel('constructor'), UNKNOWN_STAGE_LABEL);
});

test('one segment per stage of the report: done before the current one, pending after', () => {
  const states = segmentsFor(report('fetching_logs'));
  assert.equal(states.length, DIAL_STAGES.length);
  assert.deepEqual(states, [
    'done',
    'done',
    'current',
    'pending',
    'pending',
    'pending',
    'pending',
    'pending',
    'pending'
  ]);
});

test('segments come from `stages`: a dial report has none for queued, a mobile one none for ticketing', () => {
  assert.equal(segmentsFor(report('preparing')).length, 9);
  const mobile = segmentsFor(
    report('queued', { origin: 'mobile', stages: MOBILE_STAGES })
  );
  assert.equal(mobile.length, 9);
  assert.deepEqual(mobile.slice(0, 2), ['current', 'pending']);
  assert.equal(
    segmentsFor(report('uploading', { stages: ['uploading'] })).length,
    1
  );
});

test('the first and last stage are drawn as current, not as done or lost', () => {
  assert.equal(segmentsFor(report('preparing'))[0], 'current');
  const last = segmentsFor(report('finishing'));
  assert.equal(last[last.length - 1], 'current');
  assert.ok(last.slice(0, -1).every((state) => state === 'done'));
});

test('a report that was sent is all done; one that failed or was cancelled marks no step', () => {
  assert.ok(segmentsFor(report('submitted')).every((s) => s === 'done'));
  for (const stage of ['failed', 'cancelled']) {
    const states = segmentsFor(report(stage));
    assert.equal(states.length, DIAL_STAGES.length);
    assert.ok(
      states.every((s) => s === 'pending'),
      stage
    );
  }
});

test('an unknown stage inside `stages` is a segment of its own; an unknown current stage marks nothing', () => {
  const future = 'a_stage_from_the_future' as ReportStage;
  const stages = ['preparing', future, 'uploading'] as ReportStage[];
  assert.deepEqual(segmentsFor(report(future, { stages })), [
    'done',
    'current',
    'pending'
  ]);
  assert.deepEqual(segmentsFor(report('another_one', { stages })), [
    'pending',
    'pending',
    'pending'
  ]);
  assert.deepEqual(
    segmentsFor(report('preparing', { stages: undefined as never })),
    []
  );
});

test('the detail reads 3/10 when the machine counts, nothing otherwise', () => {
  assert.equal(
    detailLabel(
      report('collecting_debug_shots', { detail: { current: 3, total: 10 } })
    ),
    '3/10'
  );
  assert.equal(detailLabel(report('collecting_debug_shots')), null);
  assert.equal(
    detailLabel(report('x', { detail: { current: NaN, total: 10 } })),
    null
  );
});

test('the closing label is the contract one, with the failure code', () => {
  assert.equal(finalLabel(report('submitted')), 'Report sent');
  assert.equal(finalLabel(report('cancelled')), 'Report cancelled');
  assert.equal(
    finalLabel(
      report('failed', { failure: { code: 'BR-05', message: 'whatever' } })
    ),
    'Report failed (BR-05)'
  );
  assert.equal(finalLabel(report('failed')), 'Report failed');
});

test('the ticket is shown when the report has one', () => {
  assert.equal(
    ticketLabel(report('preparing', { ticket: 4521 })),
    'Ticket #4521'
  );
  assert.equal(ticketLabel(report('preparing', { ticket: 0 })), 'Ticket #0');
  assert.equal(ticketLabel(report('preparing')), null);
});

test('the option under the cursor stays on the list when it shrinks', () => {
  // Cancel and Back, cursor on Back; Cancel goes away at uploading.
  assert.equal(clampIndex(1, 1), 0);
  // Report over: the list is just Exit.
  assert.equal(clampIndex(2, 1), 0);
  assert.equal(clampIndex(1, 2), 1);
  assert.equal(clampIndex(0, 3), 0);
  // No options at all: never negative.
  assert.equal(clampIndex(0, 0), 0);
  assert.equal(clampIndex(4, 0), 0);
});
