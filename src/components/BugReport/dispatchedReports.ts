import {
  getReportErrorCode,
  UploadReportEvent
} from '@meticulous-home/espresso-api';

import { api } from '../../api/api';
import {
  buildDraftAttachment,
  captureException,
  CREATE_ERROR_FAILURE,
  FAILURE_DETAILS,
  FailureView,
  isReportError,
  sendSentryFeedback,
  sleep,
  SubmissionFailType,
  withRetry
} from './reportSubmission';

/**
 * Reports handed over by the mobile app.
 *
 * The phone only mints the localID, gets the ticket and dispatches; the
 * backend emits `upload_report` and the dial does the rest here, headless:
 * collect (create with the given localID), link the ticket, fetch the
 * archive, deliver to Sentry, mark submitted. The outcome is announced
 * through the notification system rather than a screen, so a brew in
 * progress is never interrupted.
 *
 * Dispatches are processed one at a time. The backend keeps a dispatch
 * `queued` until the collection succeeds, so after a reconnect the pending
 * list is replayed and nothing is lost when the live event was missed.
 */

// Not a discriminated union: this project compiles without strictNullChecks,
// where narrowing on `ok` does not reach `failure`.
export type DispatchedReportOutcome = {
  localID: string;
  ticket: number;
  ok: boolean;
  /** Set when `ok` is false. */
  failure?: FailureView;
};

type Stage =
  | 'collecting'
  | 'updatingReport'
  | 'fetchingFile'
  | 'sendingFeedback'
  | 'savingRecord';

const STAGE_FAILURE: Record<Stage, SubmissionFailType> = {
  collecting: 'creation',
  updatingReport: 'reportUpdate',
  fetchingFile: 'reportLoad',
  sendingFeedback: 'sentrySubmission',
  savingRecord: 'submissionMark'
};

// A dial-started report may hold the collection lock for minutes, so a
// dispatched one waits for it rather than giving up after the short retries
// used for the other stages.
const BUSY_RETRY_DELAY_MS = 30 * 1000;
const BUSY_RETRY_LIMIT = 20;
// Collection plus upload; generous because the archive can be large.
const DISPATCH_TIMEOUT_MS = 15 * 60 * 1000;
// A dispatch that keeps failing is retried on later reconnects, but not
// forever within one session: the backend sweep retires it eventually.
const ATTEMPT_LIMIT = 3;

type Listener = (outcome: DispatchedReportOutcome) => void;

/** One-paragraph notification text for an outcome. */
export const describeDispatchedReportOutcome = (
  outcome: DispatchedReportOutcome
): string => {
  const subject = `The report with ticket number ${outcome.ticket} from the mobile app`;
  if (outcome.ok || !outcome.failure) {
    return `${subject} was sent together with the machine's diagnostics.`;
  }
  const { message, note, code } = outcome.failure;
  return `${subject} could not be sent. ${message}${note ? ` ${note}` : ''} Error code ${code}.`;
};

const queue: UploadReportEvent[] = [];
const attempts = new Map<string, number>();
const listeners = new Set<Listener>();
let active: string | null = null;

const notify = (outcome: DispatchedReportOutcome) => {
  listeners.forEach((listener) => {
    try {
      listener(outcome);
    } catch (error) {
      console.error('[dispatched-report] outcome listener failed', error);
    }
  });
};

const collectDraft = async (event: UploadReportEvent, signal: AbortSignal) => {
  for (let busyRetries = 0; ; busyRetries++) {
    const created = await withRetry(
      async () => {
        const result = await api.createReport(
          { localID: event.localID },
          { signal }
        );
        if (isReportError(result)) {
          throw Object.assign(new Error(result.error), {
            reportCode: getReportErrorCode(result)
          });
        }
        return result;
      },
      signal,
      `collect ${event.localID}`
    ).catch((error) => {
      if (
        (error as { reportCode?: string }).reportCode ===
          'COLLECTION_IN_PROGRESS' &&
        busyRetries < BUSY_RETRY_LIMIT
      ) {
        return null;
      }
      throw error;
    });
    if (created) return created;
    await sleep(BUSY_RETRY_DELAY_MS, signal);
  }
};

const uploadDispatchedReport = async (
  event: UploadReportEvent
): Promise<DispatchedReportOutcome> => {
  const controller = new AbortController();
  const { signal } = controller;
  const timeout = setTimeout(() => controller.abort(), DISPATCH_TIMEOUT_MS);
  let stage: Stage = 'collecting';

  try {
    const draft = await collectDraft(event, signal);
    if (!draft.machineID?.trim()) {
      throw Object.assign(new Error('Draft has no machineID'), {
        failure: 'noSerial' as const
      });
    }

    stage = 'updatingReport';
    const reportInfo = await api.updateReport(
      event.localID,
      { ticket: event.ticket, description: event.description },
      { signal, timeout: 30_000 }
    );
    if (isReportError(reportInfo)) throw new Error(reportInfo.error);

    stage = 'fetchingFile';
    const draftFile = await api.getDraftReport(event.localID, { signal });
    if (isReportError(draftFile)) throw new Error(draftFile.error);
    const attachment = buildDraftAttachment(draftFile);

    stage = 'sendingFeedback';
    // Single attempt, as in the interactive flow: captureFeedback is
    // create-only, so a retry after an ambiguous result files a duplicate.
    const eventID = await sendSentryFeedback({
      reportInfo,
      attachment,
      signal,
      contact: { name: event.name, email: event.email },
      origin: 'mobile'
    });

    stage = 'savingRecord';
    const marked = await api.markSubmittedReport(
      {
        localID: event.localID,
        eventID,
        ticket: event.ticket,
        submissionTime: Math.floor(Date.now() / 1000)
      },
      { signal, timeout: 60_000 }
    );
    if (isReportError(marked)) throw new Error(marked.error);

    return { localID: event.localID, ticket: event.ticket, ok: true };
  } catch (error) {
    const failureType: SubmissionFailType = signal.aborted
      ? 'submissionTimeout'
      : ((error as { failure?: SubmissionFailType }).failure ??
        (stage === 'collecting'
          ? CREATE_ERROR_FAILURE[
              (error as { reportCode?: string }).reportCode as never
            ]
          : undefined) ??
        STAGE_FAILURE[stage]);
    const { code, message } = FAILURE_DETAILS[failureType];
    captureException(error, code);
    return {
      localID: event.localID,
      ticket: event.ticket,
      ok: false,
      failure: {
        code,
        message,
        note:
          stage === 'savingRecord'
            ? `We received the report with ticket number ${event.ticket}.`
            : undefined
      }
    };
  } finally {
    clearTimeout(timeout);
  }
};

const drain = async () => {
  if (active !== null) return;
  const next = queue.shift();
  if (!next) return;
  active = next.localID;
  attempts.set(next.localID, (attempts.get(next.localID) ?? 0) + 1);
  try {
    notify(await uploadDispatchedReport(next));
  } finally {
    active = null;
    void drain();
  }
};

export const dispatchedReports = {
  /** Queue a dispatch from the live `upload_report` event. */
  enqueue(event: UploadReportEvent) {
    if (!event?.localID || typeof event.ticket !== 'number') {
      console.warn('[dispatched-report] ignoring malformed event', event);
      return;
    }
    if (
      active === event.localID ||
      queue.some((queued) => queued.localID === event.localID) ||
      (attempts.get(event.localID) ?? 0) >= ATTEMPT_LIMIT
    ) {
      return;
    }
    queue.push(event);
    void drain();
  },

  /**
   * Replay what the backend still has queued: the live event is lost while
   * the dial is restarting or disconnected.
   */
  async syncPending() {
    const pending = await api.getPendingReportDispatches({ timeout: 15_000 });
    if (isReportError(pending)) {
      // Older backends have no dispatch endpoint; nothing to replay.
      console.warn('[dispatched-report] pending list unavailable', pending);
      return;
    }
    pending.forEach((event) => dispatchedReports.enqueue(event));
  },

  onOutcome(listener: Listener) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }
};
