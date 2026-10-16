import * as Sentry from '@sentry/react';
import {
  DraftInfo,
  PreflightBlocker,
  ReportErrorCode,
  ReportInfo
} from '@meticulous-home/espresso-api';

/**
 * Pieces of the report upload shared by the interactive flow in BugReport
 * and the headless upload of reports dispatched from the mobile app
 * (dispatchedReports.ts). Nothing in here touches React state.
 */

export type SubmissionFailType =
  | 'creation'
  | 'sentrySubmission'
  | 'reportUpdate'
  | 'submissionMark'
  | 'TicketTrackRequest'
  | 'submissionTimeout'
  | 'reportLoad'
  | 'noSerial'
  | 'offline'
  | 'diskSpace'
  | 'busy';

export type FailureView = {
  code: string;
  message: string;
  /** Extra line shown above the code, e.g. a ticket the user should keep. */
  note?: string;
};

// Every failure the user can land on gets a stable code, so support can map the
// short on-screen message back to the stage that actually failed.
export const FAILURE_DETAILS: Record<
  SubmissionFailType,
  { code: string; message: string }
> = {
  creation: {
    code: 'BR-01',
    message: 'We could not collect the information needed for your report.'
  },
  reportLoad: {
    code: 'BR-02',
    message: 'We could not prepare your report for sending.'
  },
  TicketTrackRequest: {
    code: 'BR-03',
    message: 'We could not get a tracking number for your report.'
  },
  reportUpdate: {
    code: 'BR-04',
    message: 'We could not link the tracking number to your report.'
  },
  sentrySubmission: {
    code: 'BR-05',
    message: 'We could not send your report.'
  },
  submissionMark: {
    code: 'BR-06',
    message: 'We could not update your reports record.'
  },
  submissionTimeout: {
    code: 'BR-07',
    message: 'Sending your report took too long and was cancelled.'
  },
  noSerial: {
    code: 'BR-08',
    message: 'This machine has no serial number, so a report cannot be filed.'
  },
  offline: {
    code: 'BR-09',
    message:
      'No internet connection. Connect to Wi-Fi or report from the mobile app.'
  },
  diskSpace: {
    code: 'BR-10',
    message: 'Not enough free space on the machine to collect a report.'
  },
  busy: {
    code: 'BR-11',
    message: 'Another report is being collected. Try again in a few minutes.'
  }
};

export const BLOCKER_FAILURE: Record<PreflightBlocker, SubmissionFailType> = {
  NO_SERIAL_NUMBER: 'noSerial',
  NETWORK_UNREACHABLE: 'offline',
  INSUFFICIENT_DISK_SPACE: 'diskSpace',
  COLLECTION_IN_PROGRESS: 'busy'
};

export const CREATE_ERROR_FAILURE: Partial<
  Record<ReportErrorCode, SubmissionFailType>
> = {
  INSUFFICIENT_DISK_SPACE: 'diskSpace',
  COLLECTION_IN_PROGRESS: 'busy'
};

export const SENTRY_DELIVERY_TIMEOUT_MS = 30 * 1000;

export interface DraftFile {
  name: string;
  data: Uint8Array;
  contentType: string;
}

export const getContentType = (filename: string) => {
  if (filename.endsWith('.json')) return 'application/json';
  if (filename.endsWith('.zst')) return 'application/zstd';
  if (filename.endsWith('.txt') || filename.endsWith('.log')) {
    return 'text/plain';
  }
  if (filename.endsWith('.csv')) return 'text/csv';
  return 'application/octet-stream';
};

export const captureException = (error: unknown, errorCode?: string) => {
  console.error(errorCode ? `[${errorCode}]` : '', error);
  if (Sentry.isInitialized()) {
    Sentry.captureException(
      error,
      errorCode
        ? { tags: { 'meticulous.bug_report_error_code': errorCode } }
        : undefined
    );
  }
};

const shortTag = (value: unknown) => String(value).slice(0, 200);

export const reportInfoTags = (
  reportInfo: ReportInfo
): Record<string, string> => {
  const scalars: (keyof ReportInfo)[] = [
    'localID',
    'machineID',
    'ticket',
    'issueTime',
    'dateAndTime',
    'eventID',
    'baseEventID'
  ];
  return Object.fromEntries(
    scalars
      .filter(
        (key) => reportInfo[key] !== null && reportInfo[key] !== undefined
      )
      .map((key) => [key, shortTag(reportInfo[key])])
  );
};

export const isReportError = (
  response: unknown
): response is { error: string } => {
  return (
    typeof response === 'object' &&
    response !== null &&
    'error' in response &&
    typeof response.error === 'string'
  );
};

export const isOfflineError = (error: unknown) =>
  error instanceof Error &&
  /Network Error|timeout|ERR_NETWORK|ECONN|ENOTFOUND/i.test(error.message);

export const getTicketEventID = (draftInfo: DraftInfo) => {
  const machineID = draftInfo.machineID?.trim();
  const localID = draftInfo.localID?.trim();

  if (!machineID || !localID) {
    throw new Error('Draft info is missing machineID or localID');
  }

  return `${machineID}-${localID}`;
};

export const buildDraftAttachment = (draftFile: Uint8Array): DraftFile => {
  const name = `bug-report-information.tar.zst`;

  return {
    name,
    data: draftFile,
    contentType: getContentType(name)
  };
};

export type ReportContact = {
  name?: string | null;
  /** Lands in `contexts.feedback.contact_email` on the Sentry event. */
  email?: string | null;
};

/**
 * Resolves only when Sentry acknowledged the event with a 2xx. The SDK's
 * flush() resolves true even when the transport failed, so it is no proof.
 *
 * `origin` says who asked for the report; the dial is always the sender.
 */
export const sendSentryFeedback = async ({
  reportInfo,
  attachment,
  signal,
  contact,
  origin = 'dial'
}: {
  reportInfo: ReportInfo;
  attachment: DraftFile;
  signal: AbortSignal;
  contact?: ReportContact;
  origin?: 'dial' | 'mobile';
}) => {
  const client = Sentry.getClient();
  if (!client) {
    throw new Error('Sentry is not initialized');
  }

  const expectedEvent = { id: undefined as string | undefined };
  let unhook: (() => void) | undefined;
  const delivered = new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      unhook?.();
      reject(new Error('Sentry did not acknowledge the report in time'));
    }, SENTRY_DELIVERY_TIMEOUT_MS);
    const abort = () => {
      clearTimeout(timer);
      unhook?.();
      reject(new Error('Report submission aborted'));
    };
    signal.addEventListener('abort', abort, { once: true });
    unhook = client.on('afterSendEvent', (event, response) => {
      if (!expectedEvent.id || event.event_id !== expectedEvent.id) return;
      clearTimeout(timer);
      signal.removeEventListener('abort', abort);
      unhook?.();
      const status = response?.statusCode;
      if (status !== undefined && status >= 200 && status < 300) resolve();
      else if (status === undefined)
        reject(new Error('Sentry transport failed (no response)'));
      else reject(new Error(`Sentry rejected the report with HTTP ${status}`));
    });
  });

  const contactName = contact?.name?.trim();
  const contactEmail = contact?.email?.trim();
  const defaultMessage =
    origin === 'mobile'
      ? 'Bug report dispatched from the mobile app'
      : 'Bug report submitted through quick report';

  expectedEvent.id = Sentry.captureFeedback(
    {
      ...(contactName
        ? { name: contactName }
        : reportInfo.machineID
          ? { name: reportInfo.machineID }
          : {}),
      ...(contactEmail ? { email: contactEmail } : {}),
      message: reportInfo.description || defaultMessage,
      source: 'custom',
      ...(reportInfo.baseEventID
        ? { associatedEventId: reportInfo.baseEventID }
        : {})
    },
    {
      captureContext: {
        tags: {
          ...reportInfoTags(reportInfo),
          'meticulous.report_source': 'dial',
          'meticulous.report_origin': origin,
          'meticulous.report_attachment_bytes': String(
            attachment.data.byteLength
          )
        },
        contexts: {
          report: {
            attachments: reportInfo.attachments ?? null,
            description: reportInfo.description ?? null,
            multimedia: reportInfo.multimedia ?? null
          }
        }
      },
      attachments: [
        {
          filename: attachment.name.replace(/\//g, '_'),
          data: attachment.data,
          contentType: attachment.contentType
        }
      ]
    }
  );

  await Promise.all([delivered, Sentry.flush(SENTRY_DELIVERY_TIMEOUT_MS)]);
  if (!expectedEvent.id) throw new Error('Sentry did not create an event ID');
  return expectedEvent.id;
};

export const RETRY_DELAYS_MS = [2_000, 5_000, 10_000];

export const sleep = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        reject(new Error('aborted'));
      },
      { once: true }
    );
  });

export const withRetry = async <T>(
  attempt: () => Promise<T>,
  signal: AbortSignal,
  label: string,
  delays: number[] = RETRY_DELAYS_MS
): Promise<T> => {
  let lastError: unknown;
  for (let index = 0; index <= delays.length; index++) {
    if (signal.aborted) throw lastError ?? new Error('aborted');
    try {
      return await attempt();
    } catch (error) {
      lastError = error;
      console.warn(
        `[bug-report] ${label} attempt ${index + 1} failed: ${error}`
      );
      if (index < delays.length) {
        await sleep(delays[index], signal);
      }
    }
  }
  throw lastError;
};
