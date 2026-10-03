import {
  DraftInfo,
  getReportErrorCode,
  PreflightBlocker,
  ReportErrorCode
} from '@meticulous-home/espresso-api';

import { api } from '../../api/api';
import { REPORT_PROBE_URLS } from '../../sentryConfig';
import {
  BLOCKER_FAILURE,
  captureException,
  CREATE_ERROR_FAILURE,
  isReportError,
  SubmissionFailType
} from './reportSubmission';

/**
 * The collection step of a dial report (preflight, then POST /reports/create)
 * as a run that lives outside the BugReport bubble.
 *
 * The bubble asks for a contact email on a full screen the first time, which
 * unmounts it while the machine is still collecting. The run therefore keeps
 * its own promise, the bubble attaches to it on mount and lets go of it on
 * unmount, and the hand-off below carries the run and the user's answer
 * across the screen change.
 */

export type CollectionOutcome =
  | { draft: DraftInfo }
  | { failure: SubmissionFailType; error: unknown }
  /** Cancelled by the user; the UI was already reset. */
  | null;

export type CollectionRun = {
  cancelled: boolean;
  /** Scoped to this run only, so a later run is never aborted through it. */
  controller: AbortController;
  /** The first minute passed without a draft; the copy changes. */
  slow: boolean;
  onSlow: (() => void) | null;
  /** Survives the bubble unmounting while the contact email screen is up. */
  detached: boolean;
  outcome: Promise<CollectionOutcome>;
};

const SLOW_COLLECTION_MS = 60 * 1000;

const deleteCancelledDraft = async (localID: string) => {
  try {
    const deleteResponse = await api.deleteDraftReport(localID);
    if (isReportError(deleteResponse)) {
      throw new Error(deleteResponse.error);
    }
  } catch (error) {
    // Cancellation is already complete from the user's perspective. Keep
    // this failure out of the UI, while retaining it for diagnosis.
    captureException(error);
  }
};

const collect = async (
  run: CollectionRun,
  issueTime: number | undefined
): Promise<CollectionOutcome> => {
  const { signal } = run.controller;
  try {
    const preflight = await api.getReportPreflight(REPORT_PROBE_URLS, {
      signal,
      timeout: 20_000
    });
    if (run.cancelled) return null;
    if (!isReportError(preflight)) {
      const blocker = preflight.blockers[0] as PreflightBlocker | undefined;
      if (blocker && BLOCKER_FAILURE[blocker]) {
        return { failure: BLOCKER_FAILURE[blocker], error: preflight };
      }
    } else {
      // Old backends do not have preflight. Any API error is non-blocking.
      console.warn('[bug-report] preflight unavailable, continuing', preflight);
    }

    const createResponse =
      issueTime === undefined
        ? await api.createReport(undefined, { signal })
        : await api.createReport({ issueTime }, { signal });
    if (isReportError(createResponse)) {
      throw Object.assign(new Error(createResponse.error), {
        reportCode: getReportErrorCode(createResponse)
      });
    }

    if (run.cancelled) {
      await deleteCancelledDraft(createResponse.localID);
      return null;
    }

    if (!createResponse.machineID?.trim()) {
      await deleteCancelledDraft(createResponse.localID);
      return {
        failure: 'noSerial',
        error: new Error('Draft has no machineID')
      };
    }

    return { draft: createResponse };
  } catch (error) {
    if (run.cancelled) {
      // Aborting makes createReport() resolve to an APIError that surfaces
      // here as a throw, indistinguishable from a genuine failure. Decide
      // from the run's own token: cancellation is expected user action, so
      // it is neither shown nor reported to Sentry.
      console.error(
        '[bug-report] discarded error from a cancelled report creation',
        error
      );
      return null;
    }
    const failure =
      (error as { failure?: SubmissionFailType }).failure ??
      CREATE_ERROR_FAILURE[
        (error as { reportCode?: ReportErrorCode }).reportCode ?? 'INTERNAL'
      ] ??
      'creation';
    return { failure, error };
  }
};

export const startCollection = (
  issueTime: number | undefined
): CollectionRun => {
  const run: CollectionRun = {
    cancelled: false,
    controller: new AbortController(),
    slow: false,
    onSlow: null,
    detached: false,
    outcome: Promise.resolve(null)
  };
  const slowTimer = setTimeout(() => {
    run.slow = true;
    run.onSlow?.();
  }, SLOW_COLLECTION_MS);
  run.outcome = collect(run, issueTime).finally(() => clearTimeout(slowTimer));
  return run;
};

/** Stops the in-flight request so the machine stops collecting. */
export const cancelCollection = (run: CollectionRun) => {
  run.cancelled = true;
  run.controller.abort();
};

let detachedRun: CollectionRun | null = null;
let contactDecision: { email: string | null } | null = null;

export const reportHandoff = {
  /** The bubble is about to unmount for the contact email screen. */
  detach(run: CollectionRun) {
    run.detached = true;
    detachedRun = run;
  },

  /** The bubble is back; the run is its own again. */
  takeRun(): CollectionRun | null {
    const run = detachedRun;
    detachedRun = null;
    if (run) run.detached = false;
    return run;
  },

  /** What the contact email screen ended with: an address, or none. */
  setContactDecision(email: string | null) {
    contactDecision = { email };
  },

  takeContactDecision(): { email: string | null } | null {
    const decision = contactDecision;
    contactDecision = null;
    return decision;
  }
};
