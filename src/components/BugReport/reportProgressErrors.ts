import { reportProgressStore } from './reportProgressStore.ts';

/**
 * How a cancelled report shows up in the Dial's calls, and the watch that
 * stops work on a report the mobile app cancelled.
 *
 * espresso-api 0.15 does not know the code REPORT_CANCELLED (getReportErrorCode
 * answers undefined for it), so the code is read from the error body here.
 */

export const REPORT_CANCELLED = 'REPORT_CANCELLED';
export const TOO_LATE_TO_CANCEL = 'TOO_LATE_TO_CANCEL';
export const UNKNOWN_LOCAL_ID = 'UNKNOWN_LOCAL_ID';

/** The `data.code` of an error body ({error, description, data: {code}}). */
export const reportErrorCode = (response: unknown): string | undefined => {
  if (typeof response !== 'object' || response === null) return undefined;
  if (typeof (response as { error?: unknown }).error !== 'string') {
    return undefined;
  }
  const code = (response as { data?: { code?: unknown } }).data?.code;
  return typeof code === 'string' ? code : undefined;
};

export const isCancelledResponse = (response: unknown) =>
  reportErrorCode(response) === REPORT_CANCELLED;

/** An error carrying the code, for the places that throw an API error. */
export const reportApiError = (response: { error: string }) =>
  Object.assign(new Error(response.error), {
    reportCode: reportErrorCode(response)
  });

/** What a flow throws to stop when the other app cancelled the report. */
export const cancelledError = () =>
  Object.assign(new Error('Report cancelled'), {
    reportCode: REPORT_CANCELLED
  });

export const isCancelledError = (error: unknown) =>
  (error as { reportCode?: unknown } | null)?.reportCode === REPORT_CANCELLED;

/**
 * Calls `onCancelled` once, as soon as the store says `localID` is cancelled
 * (also when it already was). Returns the function that stops watching.
 */
export const watchForCancel = (
  localID: string,
  onCancelled: () => void,
  store: Pick<
    typeof reportProgressStore,
    'get' | 'subscribe'
  > = reportProgressStore
) => {
  let done = false;
  const check = () => {
    if (done || store.get(localID)?.stage !== 'cancelled') return;
    done = true;
    unsubscribe();
    onCancelled();
  };
  const unsubscribe = store.subscribe(check);
  check();
  return () => {
    done = true;
    unsubscribe();
  };
};
