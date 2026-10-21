import axios from 'axios';
import type { APIError } from '@meticulous-home/espresso-api';

import { API_URL } from '../../api/api';
import { isCancelledResponse } from './reportProgressErrors';
import { reportProgressStore } from './reportProgressStore';
import type {
  ReportProgress,
  ReportProgressUpdate
} from './reportProgressTypes';

/**
 * The three calls of the report progress contract (v1), until the Dial moves
 * to espresso-api 0.17.0, which has them as getReportProgress,
 * updateReportProgress and cancelReport with these same shapes. Like the
 * package, they answer with an APIError instead of throwing.
 */

type RequestOptions = { signal?: AbortSignal; timeout?: number };

const client = axios.create({
  baseURL: API_URL,
  headers: { Accept: 'application/json', 'Content-Type': 'application/json' }
});

// An error without a body of the backend's: `data.status` says the machine
// answered with that HTTP status, `data.network` that it did not answer at all
// (no connection, timeout), which is the only case worth trying again.
const failure = (error: unknown): APIError => {
  const response = axios.isAxiosError(error) ? error.response : undefined;
  const body = response?.data;
  if (typeof body?.error === 'string') return body as APIError;
  return {
    error: error instanceof Error ? error.message : 'Request failed',
    description: '',
    data: response ? { status: response.status } : { network: true }
  } as APIError;
};

const noAnswer = (response: unknown) =>
  (response as { data?: { network?: boolean } } | null)?.data?.network === true;

/** Every report not over, plus those that ended a minute ago. */
export const getReportProgress = async (
  options?: RequestOptions
): Promise<ReportProgress[] | null | APIError> => {
  try {
    const response = await client.request({
      url: '/api/v1/reports/progress',
      method: 'get',
      timeout: options?.timeout ?? 15_000,
      signal: options?.signal
    });
    return Array.isArray(response.data?.content) ? response.data.content : [];
  } catch (error) {
    // A backend without progress has no such route: nothing to show.
    if (axios.isAxiosError(error) && error.response?.status === 404) {
      return null;
    }
    return failure(error);
  }
};

export const updateReportProgress = async (
  localID: string,
  update: ReportProgressUpdate,
  options?: RequestOptions
): Promise<ReportProgress | APIError> => {
  try {
    const response = await client.request({
      url: `/api/v1/reports/${encodeURIComponent(localID)}/progress`,
      method: 'post',
      data: update,
      timeout: options?.timeout ?? 15_000,
      signal: options?.signal
    });
    return response.data;
  } catch (error) {
    return failure(error);
  }
};

export const cancelReport = async (
  localID: string,
  options?: RequestOptions
): Promise<ReportProgress | APIError> => {
  try {
    const response = await client.request({
      url: `/api/v1/reports/${encodeURIComponent(localID)}/cancel`,
      method: 'post',
      timeout: options?.timeout ?? 15_000,
      signal: options?.signal
    });
    return response.data;
  } catch (error) {
    return failure(error);
  }
};

/**
 * Loads the list into the store: on every (re)connect, since events sent while
 * the Dial was away are lost. A backend without progress leaves it empty.
 */
export const syncReportProgress = async () => {
  const token = reportProgressStore.beginSnapshot();
  const snapshot = await getReportProgress();
  if (snapshot !== null && !Array.isArray(snapshot)) {
    console.warn('[report-progress] list unavailable', snapshot);
    return;
  }
  reportProgressStore.applySnapshot(snapshot, token);
};

/** How a stage post ended; the flow only cares about `cancelled`. */
export type StagePost = 'sent' | 'cancelled' | 'ignored';

// Short: the machine is on the same network, and the report must not wait on
// a post that is only there to tell the apps where it is.
const STAGE_POST_TIMEOUT_MS = 5_000;
// A failure that never reaches the machine leaves the report "running" in the
// apps, so that one post is tried a second time.
const FAILED_POST_RETRY_MS = 2_000;

/**
 * Tells the machine where the Dial's upload is, or that it failed. Best
 * effort and never throws: a backend without progress (404), a network error
 * or a timeout are `ignored`. Only a 409 REPORT_CANCELLED matters, because
 * the other app cancelled the report and the upload must stop.
 */
export const postReportProgress = async (
  localID: string,
  update: ReportProgressUpdate,
  signal?: AbortSignal
): Promise<StagePost> => {
  try {
    const send = () =>
      updateReportProgress(localID, update, {
        signal,
        timeout: STAGE_POST_TIMEOUT_MS
      });
    let response = await send();
    if ('failed' in update && noAnswer(response) && !signal?.aborted) {
      await new Promise((resolve) => setTimeout(resolve, FAILED_POST_RETRY_MS));
      response = await send();
    }
    if (isCancelledResponse(response)) return 'cancelled';
    if ('error' in response) return 'ignored';
    reportProgressStore.apply(response);
    return 'sent';
  } catch {
    return 'ignored';
  }
};
