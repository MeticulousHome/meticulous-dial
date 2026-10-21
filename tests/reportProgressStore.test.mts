import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createReportProgressStore,
  FINAL_KEPT_MS
} from '../src/components/BugReport/reportProgressStore.ts';
import type {
  ReportProgress,
  ReportStage
} from '../src/components/BugReport/reportProgressTypes.ts';

/**
 * The store behind the "Reporting an issue" entry and the progress view of the
 * bug report bubble (bug report progress, contract v1): the reports the machine
 * says are in flight, from the `report_progress` event and from
 * GET /reports/progress.
 *
 * Regressions a user at the machine would see without it:
 * - the entry reads "Reporting an issue" for a report that ended (a stale
 *   entry), or never reads it for one that runs (a dropped one);
 * - the progress view jumps back to an earlier stage when events or the list
 *   arrive out of order, or draws a finished report as running again;
 * - on a machine whose backend predates progress, something shows up that
 *   was never there: it must behave exactly as before the contract.
 *
 * Expected values come from the contract: stages only move forward and a final
 * stage is never left; the backend keeps a final report 60 s (FINAL_KEPT_MS);
 * `null` from the list means no support; clients ignore what they do not know
 * (an unknown stage, another `v`) and never crash on it; the list is sorted
 * like the backend's (oldest first). `updatedAt` has whole-second
 * resolution, so within one second the order of the report's own `stages`
 * decides, and a final stage still wins.
 *
 * Bug it catches that the suite misses: the suite had no report progress at
 * all, so any of the above went unseen until a journey run on the machine.
 */

const progress = (
  localID: string,
  stage: ReportStage | string,
  extra: Partial<ReportProgress> = {}
): ReportProgress => ({
  v: 1,
  localID,
  origin: 'mobile',
  ticket: 4521,
  stage: stage as ReportStage,
  stages: ['queued', 'preparing', 'uploading', 'finishing'],
  detail: null,
  cancellable: true,
  final: ['submitted', 'failed', 'cancelled'].includes(stage),
  failure: null,
  startedAt: 100,
  updatedAt: 100,
  ...extra
});

const clock = (start = 1_000_000) => {
  let now = start;
  return {
    now: () => now,
    advance: (ms: number) => {
      now += ms;
    }
  };
};

test('reports are listed oldest first and the one being worked on is picked before the queued ones', () => {
  const store = createReportProgressStore();
  store.apply(progress('queued-old', 'queued', { startedAt: 10 }));
  store.apply(progress('working', 'fetching_logs', { startedAt: 20 }));
  store.apply(progress('queued-new', 'queued', { startedAt: 30 }));

  assert.deepEqual(
    store.getSnapshot().map((entry) => entry.localID),
    ['queued-old', 'working', 'queued-new']
  );
  assert.equal(store.pickActive()?.localID, 'working');

  store.apply(
    progress('working', 'submitted', { startedAt: 20, updatedAt: 101 })
  );
  assert.equal(
    store.pickActive()?.localID,
    'queued-old',
    'a finished report is never the one shown as running'
  );
});

test('a late event does not move a report back, and a final one is never left', () => {
  const store = createReportProgressStore();
  store.apply(progress('r', 'uploading', { updatedAt: 105 }));
  store.apply(progress('r', 'preparing', { updatedAt: 103 }));
  assert.equal(store.get('r')?.stage, 'uploading');

  store.apply(progress('r', 'cancelled', { updatedAt: 106 }));
  store.apply(progress('r', 'finishing', { updatedAt: 107 }));
  assert.equal(store.get('r')?.stage, 'cancelled');
  assert.equal(store.pickActive(), undefined);
});

test('a dispatched report that goes back to queued is shown as queued again', () => {
  const store = createReportProgressStore();
  store.apply(progress('r', 'fetching_logs', { updatedAt: 105 }));
  // The backend sends this when a create stops without a cancel (contract).
  store.apply(progress('r', 'queued', { updatedAt: 110 }));
  assert.equal(store.get('r')?.stage, 'queued');
});

test('a final report is kept until it is shown, then dropped, and never outlives the 60 s the backend keeps it', () => {
  const time = clock();
  const store = createReportProgressStore(time.now);
  store.apply(progress('shown', 'submitted'));
  store.apply(
    progress('unseen', 'failed', {
      failure: { code: 'BR-05', message: 'We could not send your report.' }
    })
  );
  assert.equal(store.getSnapshot().length, 2);

  store.acknowledge('shown');
  assert.equal(store.get('shown'), undefined);

  time.advance(FINAL_KEPT_MS - 1);
  store.apply(progress('later', 'queued'));
  assert.ok(store.get('unseen'), 'still kept just before 60 s');

  time.advance(1);
  store.apply(progress('later', 'preparing', { updatedAt: 101 }));
  assert.equal(store.get('unseen'), undefined, 'dropped at 60 s');
});

test('acknowledging a report that is not over does nothing', () => {
  const store = createReportProgressStore();
  store.apply(progress('r', 'preparing'));
  store.acknowledge('r');
  assert.equal(store.get('r')?.stage, 'preparing');
});

test('null from the list means a backend without progress: nothing is shown and nothing breaks', () => {
  const store = createReportProgressStore();
  let notified = 0;
  store.subscribe(() => notified++);

  store.applySnapshot(null);
  assert.deepEqual(store.getSnapshot(), []);
  assert.equal(store.pickActive(), undefined);
  assert.equal(notified, 0, 'no support is not a change');

  store.apply(progress('r', 'preparing'));
  store.applySnapshot(null);
  assert.deepEqual(
    store.getSnapshot(),
    [],
    'a backend rolled back to one without support shows nothing'
  );
});

test('unknown stages and payloads of another version are tolerated', () => {
  const store = createReportProgressStore();
  store.apply(
    progress('r', 'a_stage_from_the_future', {
      stages: ['preparing', 'a_stage_from_the_future'] as ReportStage[]
    })
  );
  assert.equal(store.get('r')?.stage, 'a_stage_from_the_future');
  assert.equal(
    store.pickActive()?.localID,
    'r',
    'an unknown stage is a report in progress'
  );

  const v2 = { ...progress('other', 'preparing'), v: 2 };
  for (const junk of [v2, null, undefined, 'x', 42, {}, { v: 1 }, []]) {
    assert.doesNotThrow(() => store.apply(junk));
  }
  assert.equal(store.get('other'), undefined);
  assert.equal(store.getSnapshot().length, 1);
});

test('the list is the truth on reconnect: what it does not mention ended while the Dial was away', () => {
  const store = createReportProgressStore();
  store.apply(progress('ended', 'uploading'));
  store.apply(progress('runs', 'preparing'));

  store.applySnapshot([progress('runs', 'fetching_logs', { updatedAt: 120 })]);

  assert.equal(store.get('ended'), undefined);
  assert.equal(store.get('runs')?.stage, 'fetching_logs');
});

test('an event that arrives while the list is being fetched is not lost to an older list', () => {
  const store = createReportProgressStore();
  const token = store.beginSnapshot();
  // The list was read before this report existed; its event came in meanwhile.
  store.apply(progress('new', 'queued'));
  store.apply(progress('old', 'preparing', { updatedAt: 130 }));

  store.applySnapshot(
    [progress('old', 'preparing', { updatedAt: 120 })],
    token
  );

  assert.ok(store.get('new'), 'the report the list could not know about stays');
  assert.equal(store.get('old')?.updatedAt, 130, 'and the newer payload stays');
});

test('listeners hear changes only, and the snapshot keeps its identity otherwise', () => {
  const store = createReportProgressStore();
  let notified = 0;
  const unsubscribe = store.subscribe(() => notified++);

  store.apply(progress('r', 'preparing', { updatedAt: 105 }));
  const before = store.getSnapshot();
  assert.equal(notified, 1);

  store.apply(progress('r', 'queued', { updatedAt: 99 })); // late: ignored
  assert.equal(notified, 1);
  assert.equal(store.getSnapshot(), before);

  unsubscribe();
  store.apply(progress('r', 'uploading', { updatedAt: 106 }));
  assert.equal(notified, 1);
});

test('the request to open the progress view is read once', () => {
  const store = createReportProgressStore();
  assert.equal(store.takeViewRequest(), false);
  store.requestView();
  assert.equal(store.takeViewRequest(), true);
  assert.equal(store.takeViewRequest(), false);
});

test('two changes in the same second keep the later stage, whichever arrives last', () => {
  const store = createReportProgressStore();
  store.apply(progress('r', 'uploading', { updatedAt: 105 }));
  // updatedAt has whole-second resolution, so this cannot be told apart from
  // a newer payload by time: the report's own `stages` order decides.
  store.apply(progress('r', 'preparing', { updatedAt: 105 }));
  assert.equal(store.get('r')?.stage, 'uploading');

  store.apply(progress('r', 'finishing', { updatedAt: 105 }));
  assert.equal(
    store.get('r')?.stage,
    'finishing',
    'a later stage still advances'
  );
});

test('in the same second a final stage wins over a running one and stays final', () => {
  const store = createReportProgressStore();
  store.apply(progress('r', 'uploading', { updatedAt: 105 }));
  store.apply(progress('r', 'cancelled', { updatedAt: 105 }));
  assert.equal(store.get('r')?.stage, 'cancelled');

  store.apply(progress('r', 'finishing', { updatedAt: 105 }));
  assert.equal(store.get('r')?.stage, 'cancelled');
});

test('in the same second an unknown stage is accepted: nothing says it is earlier', () => {
  const store = createReportProgressStore();
  store.apply(progress('r', 'uploading', { updatedAt: 105 }));
  store.apply(progress('r', 'a_stage_from_the_future', { updatedAt: 105 }));
  assert.equal(store.get('r')?.stage, 'a_stage_from_the_future');
});

test('peeking at the view request does not consume it', () => {
  const store = createReportProgressStore();
  store.requestView();
  assert.equal(store.peekViewRequest(), true);
  assert.equal(store.peekViewRequest(), true);
  assert.equal(store.takeViewRequest(), true);
  assert.equal(store.peekViewRequest(), false);
});
