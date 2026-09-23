import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import * as Sentry from '@sentry/react';
import { AnimatedCounter } from 'react-animated-counter/dist/esm';
import { useHandleGestures } from '../../hooks/useHandleGestures';
import {
  BugReportAnimation,
  BugReportAnimationPhase
} from './BugReportAnimation';
import { QrGeneratedImage } from '../QR/QrImage';
import {
  setBubbleDisplay,
  setBubblePinned,
  setScreen
} from '../store/features/screens/screens-slice';
import { useAppDispatch, useAppSelector } from '../store/hooks';

import {
  ReportInfo,
  DraftInfo,
  getReportErrorCode,
  PreflightBlocker,
  ReportErrorCode
} from '@meticulous-home/espresso-api';

import { api } from '../../api/api';
import { useIdleTimer } from '../../hooks/useIdleTimer';
import { REPORT_PROBE_URLS, TICKET_SERVICE_URL } from '../../sentryConfig';

import './bugReport.css';

enum ReportScreen {
  message = 'message',
  reportSetup = 'reportSetup',
  selectIssueDate = 'selectIssueDate',
  reportingBug = 'reportingBug',
  contactInfo = 'contactInfo',
  submitted = 'submitted'
}

enum ReportStatus {
  idle = 'idle',
  fetching = 'fetching',
  slowFetch = 'slowFetch',
  submitting = 'submitting',
  failed = 'failed'
}

type SubmissionFailType =
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

type SubmissionStateType =
  | null
  | 'fetchingFile'
  | 'buildingFeedback'
  | 'ticketing'
  | 'updatingReport'
  | 'sendingFeedback'
  | 'savingRecord';

// Every failure the user can land on gets a stable code, so support can map the
// short on-screen message back to the stage that actually failed.
const FAILURE_DETAILS: Record<
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
    message: 'No internet connection. Connect to Wi-Fi or report from the mobile app.'
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

const CONTACT_SUPPORT_NOTE = 'Please contact us for further information.';

// The submitted screen waits on the closing animation. A dropped 'complete'
// event would strand the user on a screen that offers no options at all, so the
// wait is capped. A submission landing at the worst moment queues behind the
// collecting loop's boundary (up to 2.0s), the bridge (2.4s) and Finished
// itself (1.1s), so the cap has to clear 5.5s with room for a slow frame rate.
const FINISHED_ANIMATION_TIMEOUT = 12 * 1000;
const SENTRY_DELIVERY_TIMEOUT_MS = 30 * 1000;

type FailureView = {
  code: string;
  message: string;
  /** Extra line shown above the code, e.g. a ticket the user should keep. */
  note?: string;
};

type InFlightSubmission = {
  localID: string;
  outcome: Promise<{ ticket: number | null; failure: FailureView | null }>;
};

// A bubble can be unmounted by navigation while delivery continues. Keep the
// result outside the component so the next mount can show it.
let inFlightSubmission: InFlightSubmission | null = null;

type BugReportOption = {
  key:
    | 'contactInfo'
    | 'reportIssue'
    | 'report'
    | 'selectDate'
    | 'back'
    | 'cancel'
    | 'exit';
  label: string;
  useableWidthPercentage: number;
};

type IssueDateField = 'day' | 'month' | 'year' | 'hours' | 'minutes';

type CreateReportRun = {
  cancelled: boolean;
  slowTimeout: ReturnType<typeof setTimeout> | null;
  controller: AbortController;
};

const ISSUE_DATE_FIELDS: IssueDateField[] = [
  'day',
  'month',
  'year',
  'hours',
  'minutes'
];

const ISSUE_DATE_ACTIVE_COLOR = '#f5c444';
const ISSUE_DATE_INACTIVE_COLOR = '#E6E6E6';
const ISSUE_DATE_COUNTER_STYLE = {
  margin: 0,
  fontSize: 38,
  fontFamily: 'ABC Diatype Mono',
  fontWeight: 300,
  letterSpacing: '-0.02em'
};

const ISSUE_DATE_HINTS = [
  { input: 'Press', action: 'Change field' },
  { input: 'Long press', action: 'Confirm' },
  { input: 'Double press', action: 'Back' }
];

const padTwo = (value: number) => String(value).padStart(2, '0');

// Both issue-date screens share these so the summary can never drift from the
// format the picker edits in.
const formatIssueDate = (date: Date) =>
  `${padTwo(date.getDate())}.${padTwo(date.getMonth() + 1)}.${date.getFullYear()}`;

const formatIssueTime = (date: Date) =>
  `${padTwo(date.getHours())}:${padTwo(date.getMinutes())}`;

// The summary labels its parts by splitting the formatted string rather than
// re-deriving them, so it cannot grow a second definition of the format.
const ISSUE_DATE_LABELS = ['Day', 'Month', 'Year'];
const ISSUE_TIME_LABELS = ['Hour', 'Min'];

const toLabelledParts = (
  formatted: string,
  separator: string,
  labels: string[]
) =>
  formatted
    .split(separator)
    .map((value, index) => ({ label: labels[index], value }));

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

const SUPPORT_WEBSITE_URL = 'https://meticuloushome.com/pages/contact';

const captureException = (error: unknown, errorCode?: string) => {
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

const reportInfoTags = (reportInfo: ReportInfo): Record<string, string> => {
  const scalars: (keyof ReportInfo)[] = [
    'localID', 'machineID', 'ticket', 'issueTime', 'dateAndTime', 'eventID', 'baseEventID'
  ];
  return Object.fromEntries(
    scalars
      .filter((key) => reportInfo[key] !== null && reportInfo[key] !== undefined)
      .map((key) => [key, shortTag(reportInfo[key])])
  );
};

const BLOCKER_FAILURE: Record<PreflightBlocker, SubmissionFailType> = {
  NO_SERIAL_NUMBER: 'noSerial',
  NETWORK_UNREACHABLE: 'offline',
  INSUFFICIENT_DISK_SPACE: 'diskSpace',
  COLLECTION_IN_PROGRESS: 'busy'
};

const CREATE_ERROR_FAILURE: Partial<Record<ReportErrorCode, SubmissionFailType>> = {
  INSUFFICIENT_DISK_SPACE: 'diskSpace',
  COLLECTION_IN_PROGRESS: 'busy'
};

const isReportError = (response: unknown): response is { error: string } => {
  return (
    typeof response === 'object' &&
    response !== null &&
    'error' in response &&
    typeof response.error === 'string'
  );
};

const getTicketEventID = (draftInfo: DraftInfo) => {
  const machineID = draftInfo.machineID?.trim();
  const localID = draftInfo.localID?.trim();

  if (!machineID || !localID) {
    throw new Error('Draft info is missing machineID or localID');
  }

  return `${machineID}-${localID}`;
};

const buildDraftAttachment = (draftFile: Uint8Array): DraftFile => {
  const name = `bug-report-information.tar.zst`;

  return {
    name,
    data: draftFile,
    contentType: getContentType(name)
  };
};

const sendSentryFeedback = async ({
  reportInfo,
  attachment,
  signal
}: {
  reportInfo: ReportInfo;
  attachment: DraftFile;
  signal: AbortSignal;
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
      else if (status === undefined) reject(new Error('Sentry transport failed (no response)'));
      else reject(new Error(`Sentry rejected the report with HTTP ${status}`));
    });
  });

  expectedEvent.id = Sentry.captureFeedback(
    {
      ...(reportInfo.machineID ? { name: reportInfo.machineID } : {}),
      message:
        reportInfo.description || 'Bug report submitted through quick report',
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

const RETRY_DELAYS_MS = [2_000, 5_000, 10_000];

const sleep = (ms: number, signal: AbortSignal) =>
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

const withRetry = async <T,>(
  attempt: () => Promise<T>,
  signal: AbortSignal,
  label: string
): Promise<T> => {
  let lastError: unknown;
  for (let index = 0; index <= RETRY_DELAYS_MS.length; index++) {
    if (signal.aborted) throw lastError ?? new Error('aborted');
    try {
      return await attempt();
    } catch (error) {
      lastError = error;
      console.warn(`[bug-report] ${label} attempt ${index + 1} failed`, error);
      if (index < RETRY_DELAYS_MS.length) {
        await sleep(RETRY_DELAYS_MS[index], signal);
      }
    }
  }
  throw lastError;
};

/** The read-only counterpart of the picker row, labelled the same way. */
const IssueDateParts = ({
  parts,
  separator
}: {
  parts: { label: string; value: string }[];
  separator: string;
}) => (
  <div className="bug-report-date-row">
    {parts.map((part, index) => (
      <Fragment key={part.label}>
        {index > 0 && (
          <span className="bug-report-date-separator">{separator}</span>
        )}
        <div className="bug-report-date-part">
          <span className="bug-report-date-label">{part.label}</span>
          <span className="bug-report-date-value">{part.value}</span>
        </div>
      </Fragment>
    ))}
  </div>
);

const IssueDateCounter = ({
  active,
  label,
  value,
  pad = false
}: {
  active: boolean;
  /** Names the field, since digits alone do not say which is which. */
  label: string;
  value: number;
  /** Keeps two-digit fields two digits wide, so the row never shifts. */
  pad?: boolean;
}) => (
  <div className="bug-report-date-part">
    {/* Above the digits: the underline below them already marks the active
        field, and a label there would compete with it. */}
    <span className="bug-report-date-label">{label}</span>
    <div
      className={`bug-report-date-picker-field${
        active ? ' bug-report-date-picker-active' : ''
      }`}
    >
      {/* AnimatedCounter takes a number, so the leading zero is drawn alongside it. */}
      {pad && value < 10 && <span>0</span>}
      <AnimatedCounter
        value={value}
        color={ISSUE_DATE_INACTIVE_COLOR}
        decrementColor={ISSUE_DATE_ACTIVE_COLOR}
        incrementColor={ISSUE_DATE_ACTIVE_COLOR}
        includeDecimals={false}
        fontSize="38px"
        containerStyles={ISSUE_DATE_COUNTER_STYLE}
      />
    </div>
  </div>
);

export const BugReport = (): JSX.Element => {
  const dispatch = useAppDispatch();
  const currentScreen = useAppSelector((state) => state.screen.value);
  const previousScreen = useAppSelector((state) => state.screen.prev);
  const [reportScreen, setReportScreen] = useState(ReportScreen.message);
  const [reportStatus, setReportStatus] = useState(ReportStatus.idle);
  const [activeIndex, setActiveIndex] = useState(0);
  const [failure, setFailure] = useState<FailureView | null>(null);
  const [selectedIssueTimestamp, setSelectedIssueTimestamp] = useState<
    number | undefined
  >();
  const [issueDateDraft, setIssueDateDraft] = useState(() => new Date());
  const [activeIssueDateField, setActiveIssueDateField] =
    useState<IssueDateField>('day');
  const [isFinishing, setIsFinishing] = useState(false);
  const draftInfoRef = useRef<DraftInfo | null>(null);
  const ticketRef = useRef<number | null>(null);
  const submissionStateRef = useRef<SubmissionStateType>(null);
  const activeCreateRunRef = useRef<CreateReportRun | null>(null);
  const submitControllerRef = useRef<AbortController | null>(null);
  const finishedResolveRef = useRef<(() => void) | null>(null);
  const { resetTimer: resetIdleTimer } = useIdleTimer();

  const busy =
    reportStatus === ReportStatus.fetching ||
    reportStatus === ReportStatus.slowFetch ||
    reportStatus === ReportStatus.submitting;

  const animationPhase: BugReportAnimationPhase = isFinishing
    ? 'finished'
    : reportStatus === ReportStatus.submitting
      ? 'submitting'
      : 'collecting';

  const handleFinishedAnimationEnd = () => {
    const resolve = finishedResolveRef.current;
    finishedResolveRef.current = null;
    resolve?.();
  };

  // Switches the animation to Finished and settles once it has played out.
  const playFinishedAnimation = () =>
    new Promise<void>((resolve) => {
      const safety = setTimeout(() => {
        finishedResolveRef.current = null;
        resolve();
      }, FINISHED_ANIMATION_TIMEOUT);

      finishedResolveRef.current = () => {
        clearTimeout(safety);
        resolve();
      };
      setIsFinishing(true);
    });

  const options = useMemo<BugReportOption[]>(() => {
    if (reportScreen === ReportScreen.message) {
      return [
        {
          key: 'contactInfo',
          label: 'Contact info',
          useableWidthPercentage: 81
        },
        {
          key: 'reportIssue',
          label: 'Report an issue',
          useableWidthPercentage: 81
        },
        { key: 'back', label: 'Back', useableWidthPercentage: 81 }
      ];
    }

    if (reportScreen === ReportScreen.contactInfo) {
      return [{ key: 'back', label: 'Back', useableWidthPercentage: 81 }];
    }

    if (reportScreen === ReportScreen.reportSetup) {
      return [
        { key: 'report', label: 'Report', useableWidthPercentage: 81 },
        {
          key: 'selectDate',
          label: 'Select date',
          useableWidthPercentage: 81
        },
        { key: 'back', label: 'Back', useableWidthPercentage: 81 }
      ];
    }

    if (
      reportScreen === ReportScreen.reportingBug &&
      (reportStatus === ReportStatus.fetching ||
        reportStatus === ReportStatus.slowFetch)
    ) {
      return [{ key: 'cancel', label: 'Cancel', useableWidthPercentage: 81 }];
    }

    if (
      reportScreen === ReportScreen.reportingBug &&
      reportStatus === ReportStatus.failed
    ) {
      return [{ key: 'exit', label: 'Exit', useableWidthPercentage: 81 }];
    }

    if (reportScreen === ReportScreen.submitted) {
      return [{ key: 'exit', label: 'Exit', useableWidthPercentage: 81 }];
    }

    return [];
  }, [reportScreen, reportStatus]);

  const exitToQuickSettings = () => {
    dispatch(setBubblePinned(false));
    const targetScreen =
      currentScreen === 'bug-report'
        ? previousScreen || 'profileHome'
        : currentScreen;

    if (targetScreen !== currentScreen) {
      dispatch(setScreen(targetScreen));
      return;
    }
    dispatch(setBubbleDisplay({ visible: true, component: 'quick-settings' }));
  };

  const failSubmission = (
    failureType: SubmissionFailType,
    error: unknown,
    note?: string
  ) => {
    const { code, message } = FAILURE_DETAILS[failureType];
    setFailure({ code, message, note });
    setReportStatus(ReportStatus.failed);
    submissionStateRef.current = null;
    setIsFinishing(false);
    captureException(error, code);
  };

  const resetCancelledReport = () => {
    dispatch(setBubblePinned(false));
    setReportScreen(ReportScreen.message);
    setReportStatus(ReportStatus.idle);
    setActiveIndex(0);
    setFailure(null);
    setSelectedIssueTimestamp(undefined);
    setIssueDateDraft(new Date());
    setActiveIssueDateField('day');
    draftInfoRef.current = null;
    ticketRef.current = null;
    submissionStateRef.current = null;
    setIsFinishing(false);
  };

  const deleteCancelledDraft = async (localID: string) => {
    try {
      const deleteResponse = await api.deleteDraftReport(localID);
      if (isReportError(deleteResponse)) {
        throw new Error(deleteResponse.error);
      }
    } catch (error) {
      // Cancellation is already complete from the user's perspective. Keep
      // this failure out of the reset UI, while retaining it for diagnosis.
      captureException(error);
    }
  };

  const cancelCreateReport = () => {
    const createRun = activeCreateRunRef.current;
    if (!createRun) return;

    createRun.cancelled = true;
    // Stops the in-flight request so the machine stops collecting; scoped to
    // this run's own controller, so a later run is never touched by it.
    createRun.controller.abort();
    if (createRun.slowTimeout) {
      clearTimeout(createRun.slowTimeout);
      createRun.slowTimeout = null;
    }
    activeCreateRunRef.current = null;
    resetCancelledReport();
  };

  const startCreateReport = () => {
    // A fresh controller per run: it lives and dies with this createRun, is
    // never reused, and a later run can never be aborted through it.
    const createRun: CreateReportRun = {
      cancelled: false,
      slowTimeout: null,
      controller: new AbortController()
    };
    const issueTime = selectedIssueTimestamp;

    activeCreateRunRef.current = createRun;
    setReportScreen(ReportScreen.reportingBug);
    setReportStatus(ReportStatus.fetching);
    setActiveIndex(0);
    setFailure(null);
    setIsFinishing(false);
    draftInfoRef.current = null;

    createRun.slowTimeout = setTimeout(() => {
      if (!createRun.cancelled && activeCreateRunRef.current === createRun) {
        setReportStatus(ReportStatus.slowFetch);
      }
    }, 60 * 1000); // message change on the first minute mark

    void (async () => {
      try {
        const preflight = await api.getReportPreflight(REPORT_PROBE_URLS, {
          signal: createRun.controller.signal,
          timeout: 20_000
        });
        if (createRun.cancelled) return;
        if (!isReportError(preflight)) {
          const blocker = preflight.blockers[0] as PreflightBlocker | undefined;
          if (blocker && BLOCKER_FAILURE[blocker]) {
            activeCreateRunRef.current = null;
            failSubmission(BLOCKER_FAILURE[blocker], preflight);
            return;
          }
        } else {
          // Old backends do not have preflight. Any API error is non-blocking.
          console.warn('[bug-report] preflight unavailable, continuing', preflight);
        }
        const createResponse =
          issueTime === undefined
            ? await api.createReport(undefined, {
                signal: createRun.controller.signal
              })
            : await api.createReport(
                { issueTime },
                { signal: createRun.controller.signal }
              );
        if (isReportError(createResponse)) {
          throw Object.assign(new Error(createResponse.error), {
            reportCode: getReportErrorCode(createResponse)
          });
        }

        if (createRun.cancelled) {
          await deleteCancelledDraft(createResponse.localID);
          return;
        }

        if (!createResponse.machineID?.trim()) {
          await deleteCancelledDraft(createResponse.localID);
          throw Object.assign(new Error('Draft has no machineID'), {
            failure: 'noSerial' as const
          });
        }

        activeCreateRunRef.current = null;
        draftInfoRef.current = createResponse;
        setReportStatus(ReportStatus.submitting);
        void submitReport(createResponse);
      } catch (error) {
        if (createRun.cancelled) {
          // Aborting makes createReport() resolve to an APIError that surfaces
          // here as a throw, indistinguishable from a genuine failure. Decide
          // from the run's own token, not this value: cancellation is expected
          // user action, not a failure, so it must never reach the
          // already-reset UI, and it must never be reported to Sentry.
          console.error(
            '[bug-report] discarded error from a cancelled report creation',
            error
          );
        } else if (activeCreateRunRef.current === createRun) {
          activeCreateRunRef.current = null;
          const failure =
            (error as { failure?: SubmissionFailType }).failure ??
            CREATE_ERROR_FAILURE[
              (error as { reportCode?: ReportErrorCode }).reportCode ?? 'INTERNAL'
            ] ??
            'creation';
          failSubmission(failure, error);
        }
      } finally {
        if (createRun.slowTimeout) {
          clearTimeout(createRun.slowTimeout);
          createRun.slowTimeout = null;
        }
      }
    })();
  };

  useEffect(() => {
    dispatch(setBubblePinned(busy));
    if (!busy) return;
    resetIdleTimer();
    const keepAlive = setInterval(resetIdleTimer, 30_000);
    return () => clearInterval(keepAlive);
  }, [busy, dispatch, resetIdleTimer]);

  useEffect(
    () => () => {
      const run = activeCreateRunRef.current;
      if (run) {
        run.cancelled = true;
        run.controller.abort();
        if (run.slowTimeout) clearTimeout(run.slowTimeout);
        activeCreateRunRef.current = null;
      }
      dispatch(setBubblePinned(false));
    },
    [dispatch]
  );

  const openIssueDateSelector = () => {
    setIssueDateDraft(() => {
      const savedDate = new Date(
        selectedIssueTimestamp === undefined
          ? Date.now()
          : selectedIssueTimestamp * 1000
      );
      savedDate.setMinutes(Math.floor(savedDate.getMinutes() / 30) * 30);
      return savedDate;
    });
    setActiveIssueDateField('day');
    setActiveIndex(0);
    setReportScreen(ReportScreen.selectIssueDate);
  };

  const changeIssueDate = (direction: number) => {
    setIssueDateDraft((previousDate) => {
      const nextDate = new Date(previousDate.getTime());

      // Minutes are always in 30-minute increments, so the user can only select 0 or 30.
      nextDate.setMinutes(Math.floor(nextDate.getMinutes() / 30) * 30);

      switch (activeIssueDateField) {
        case 'day':
          nextDate.setDate(nextDate.getDate() + direction);
          break;
        case 'month':
          nextDate.setMonth(nextDate.getMonth() + direction);
          break;
        case 'year':
          nextDate.setFullYear(nextDate.getFullYear() + direction);
          break;
        case 'hours':
          nextDate.setHours(nextDate.getHours() + direction);
          break;
        case 'minutes':
          nextDate.setMinutes(nextDate.getMinutes() + direction * 30);
          break;
      }

      if (nextDate.getTime() > Date.now()) {
        nextDate.setTime(Date.now());
        nextDate.setMinutes(Math.floor(nextDate.getMinutes() / 30) * 30);
      }

      return nextDate;
    });
  };

  const confirmIssueDate = () => {
    setSelectedIssueTimestamp(Math.floor(issueDateDraft.getTime() / 1000));
    setReportScreen(ReportScreen.reportSetup);
    setReportStatus(ReportStatus.idle);
    setActiveIndex(0);
  };

  const cancelIssueDateSelection = () => {
    setReportScreen(ReportScreen.reportSetup);
    setReportStatus(ReportStatus.idle);
    setActiveIndex(0);
  };

  const setSubmissionStage = (stage: SubmissionStateType) => {
    submissionStateRef.current = stage;
  };

  const submitReport = async (draftInfo: DraftInfo) => {
    if (!draftInfo.localID) {
      failSubmission('reportLoad', 'No draft report');
      return;
    }

    const controller = new AbortController();
    submitControllerRef.current = controller;
    const { signal } = controller;
    let resolveOutcome: (
      value: { ticket: number | null; failure: FailureView | null }
    ) => void;
    const outcome = new Promise<{
      ticket: number | null;
      failure: FailureView | null;
    }>((resolve) => {
      resolveOutcome = resolve;
    });
    const submission = { localID: draftInfo.localID, outcome };
    inFlightSubmission = submission;
    let outcomeFailure: FailureView | null = null;
    setReportStatus(ReportStatus.submitting);
    setFailure(null);

    let timedOut = false;
    const submissionTimeout = setTimeout(
      () => {
        timedOut = true;
        controller.abort();
        failSubmission(
          'submissionTimeout',
          'Report submission timed out',
          ticketRef.current !== null
            ? `A ticket number ${ticketRef.current} was reserved. Save it in case the report arrived.`
            : undefined
        );
        outcomeFailure = {
          ...FAILURE_DETAILS.submissionTimeout,
          note:
            ticketRef.current !== null
              ? `A ticket number ${ticketRef.current} was reserved. Save it in case the report arrived.`
              : undefined
        };
      },
      5 * 60 * 1000
    ); // 5 minutes timeout

    try {
      setSubmissionStage('ticketing');
      const ticket = await withRetry(
        async () => {
          const result = await api.getMeticulousReportTracking(
            TICKET_SERVICE_URL,
            { eventID: getTicketEventID(draftInfo) },
            { signal, timeout: 15_000 }
          );
          if (isReportError(result)) throw new Error(result.error);
          if (!Number.isSafeInteger(result)) {
            throw new Error('Ticket service returned no ticket');
          }
          return result;
        },
        signal,
        'ticket'
      );
      ticketRef.current = ticket;

      setSubmissionStage('updatingReport');
      const reportInfo = await api.updateReport(
        draftInfo.localID,
        { ticket },
        { signal, timeout: 30_000 }
      );
      if (isReportError(reportInfo)) throw Error(reportInfo.error);

      setSubmissionStage('fetchingFile');
      const draftFile = await api.getDraftReport(draftInfo.localID, { signal });
      if (isReportError(draftFile)) throw Error(draftFile.error);

      setSubmissionStage('buildingFeedback');
      const attachment = buildDraftAttachment(draftFile);

      setSubmissionStage('sendingFeedback');
      const eventID = await withRetry(
        () => sendSentryFeedback({ reportInfo, attachment, signal }),
        signal,
        'sentry'
      );

      setSubmissionStage('savingRecord');
      const markSubmittedResponse = await api.markSubmittedReport(
        {
          localID: draftInfo.localID,
          eventID,
          ticket,
          submissionTime: Math.floor(Date.now() / 1000)
        },
        { signal, timeout: 60_000 }
      );
      if (isReportError(markSubmittedResponse)) {
        throw Error(markSubmittedResponse.error);
      }

      // The report is in. Everything left is animation, so retire the network
      // timeout rather than let it fail a submission that already succeeded.
      clearTimeout(submissionTimeout);
      await playFinishedAnimation();

      setSubmissionStage(null);
      setReportScreen(ReportScreen.submitted);
      setReportStatus(ReportStatus.idle);
    } catch (error) {
      if (timedOut || signal.aborted) return;

      if (submissionStateRef.current === 'sendingFeedback') {
        failSubmission('sentrySubmission', error);
        outcomeFailure = FAILURE_DETAILS.sentrySubmission;
      } else if (submissionStateRef.current === 'ticketing') {
        const failure = isOfflineError(error) ? 'offline' : 'TicketTrackRequest';
        failSubmission(failure, error);
        outcomeFailure = FAILURE_DETAILS[failure];
      } else if (submissionStateRef.current === 'updatingReport') {
        failSubmission('reportUpdate', error);
        outcomeFailure = FAILURE_DETAILS.reportUpdate;
      } else if (submissionStateRef.current === 'savingRecord') {
        // The report itself made it through, so the ticket is still usable.
        failSubmission(
          'submissionMark',
          error,
          `We received your report with ticket number ${ticketRef.current}. Save it for further tracking.`
        );
        outcomeFailure = {
          ...FAILURE_DETAILS.submissionMark,
          note: `We received your report with ticket number ${ticketRef.current}. Save it for further tracking.`
        };
      } else {
        failSubmission('reportLoad', error);
        outcomeFailure = FAILURE_DETAILS.reportLoad;
      }
    } finally {
      clearTimeout(submissionTimeout);
      if (submitControllerRef.current === controller) submitControllerRef.current = null;
      resolveOutcome!({ ticket: ticketRef.current, failure: outcomeFailure });
      if (inFlightSubmission === submission) inFlightSubmission = null;
    }
  };

  useEffect(() => {
    const pending = inFlightSubmission;
    if (!pending) return;
    let disposed = false;
    setReportScreen(ReportScreen.reportingBug);
    setReportStatus(ReportStatus.submitting);
    void pending.outcome.then(({ ticket, failure: pendingFailure }) => {
      if (disposed) return;
      ticketRef.current = ticket;
      if (pendingFailure) {
        setFailure(pendingFailure);
        setReportStatus(ReportStatus.failed);
      } else {
        setReportScreen(ReportScreen.submitted);
        setReportStatus(ReportStatus.idle);
      }
    });
    return () => {
      disposed = true;
    };
  }, []);

  const isOfflineError = (error: unknown) =>
    error instanceof Error &&
    /Network Error|timeout|ERR_NETWORK|ECONN|ENOTFOUND/i.test(error.message);

  useHandleGestures({
    left() {
      if (reportScreen === ReportScreen.selectIssueDate) {
        changeIssueDate(-1);
        return;
      }
      if (options.length === 0) return;
      setActiveIndex((prev) => Math.max(prev - 1, 0));
    },
    right() {
      if (reportScreen === ReportScreen.selectIssueDate) {
        changeIssueDate(1);
        return;
      }
      if (options.length === 0) return;
      setActiveIndex((prev) => Math.min(prev + 1, options.length - 1));
    },
    pressDown() {
      if (reportScreen === ReportScreen.selectIssueDate) {
        setActiveIssueDateField((previousField) => {
          const currentIndex = ISSUE_DATE_FIELDS.indexOf(previousField);
          return ISSUE_DATE_FIELDS[
            (currentIndex + 1) % ISSUE_DATE_FIELDS.length
          ];
        });
        return;
      }
      const activeOption = options[activeIndex];
      if (!activeOption || reportStatus === ReportStatus.submitting) return;

      switch (activeOption.key) {
        case 'contactInfo':
          setReportScreen(ReportScreen.contactInfo);
          setReportStatus(ReportStatus.idle);
          setActiveIndex(0);
          break;
        case 'reportIssue':
          setReportScreen(ReportScreen.reportSetup);
          setReportStatus(ReportStatus.idle);
          setActiveIndex(0);
          break;
        case 'report':
          startCreateReport();
          break;
        case 'selectDate':
          openIssueDateSelector();
          break;
        case 'cancel':
          cancelCreateReport();
          break;
        case 'back':
          if (reportScreen === ReportScreen.message) {
            exitToQuickSettings();
          } else if (reportScreen === ReportScreen.reportSetup) {
            setReportScreen(ReportScreen.message);
            setReportStatus(ReportStatus.idle);
            setActiveIndex(0);
            break;
          }
          setReportScreen(ReportScreen.message);
          setReportStatus(ReportStatus.idle);
          setActiveIndex(0);
          break;
        case 'exit':
          exitToQuickSettings();
          break;
      }
    },
    longEncoder() {
      if (reportScreen === ReportScreen.selectIssueDate) {
        confirmIssueDate();
      }
    },
    doubleClick() {
      if (reportScreen === ReportScreen.selectIssueDate) {
        cancelIssueDateSelection();
      }
    }
  });

  const message = useMemo(() => {
    if (reportScreen === ReportScreen.message) {
      return (
        <>
          <div style={{ marginTop: '10px' }}>
            <span>
              This action will send debug data and provide You with a{' '}
              <strong>bug report number</strong>.
            </span>
          </div>
          <div style={{ marginTop: '10px' }}>
            <span>
              Click on <strong>contact info</strong> to display QR coded contact
              information or <strong>report an issue</strong> to continue.
            </span>
          </div>
          <div style={{ marginTop: '10px' }}>
            <span>We strongly recommend reporting from the mobile app</span>
          </div>
        </>
      );
    }

    if (reportScreen === ReportScreen.reportSetup) {
      const reportDate = new Date(
        selectedIssueTimestamp === undefined
          ? Date.now()
          : selectedIssueTimestamp * 1000
      );
      return (
        <>
          <span className="bug-report-eyebrow">Issue date &amp; time</span>
          <div className="bug-report-issue-date-display">
            <IssueDateParts
              separator="."
              parts={toLabelledParts(
                formatIssueDate(reportDate),
                '.',
                ISSUE_DATE_LABELS
              )}
            />
            <IssueDateParts
              separator=":"
              parts={toLabelledParts(
                formatIssueTime(reportDate),
                ':',
                ISSUE_TIME_LABELS
              )}
            />
          </div>
        </>
      );
    }

    if (reportScreen === ReportScreen.selectIssueDate) {
      return (
        <>
          <span className="bug-report-eyebrow">
            Guide us to when the issue occurred
          </span>
          <div className="bug-report-date-picker">
            <div className="bug-report-date-row">
              <IssueDateCounter
                active={activeIssueDateField === 'day'}
                label="Day"
                value={issueDateDraft.getDate()}
                pad
              />
              <span className="bug-report-date-separator">.</span>
              <IssueDateCounter
                active={activeIssueDateField === 'month'}
                label="Month"
                value={issueDateDraft.getMonth() + 1}
                pad
              />
              <span className="bug-report-date-separator">.</span>
              <IssueDateCounter
                active={activeIssueDateField === 'year'}
                label="Year"
                value={issueDateDraft.getFullYear()}
              />
            </div>
            <div className="bug-report-date-row">
              <IssueDateCounter
                active={activeIssueDateField === 'hours'}
                label="Hour"
                value={issueDateDraft.getHours()}
                pad
              />
              <span className="bug-report-date-separator">:</span>
              <IssueDateCounter
                active={activeIssueDateField === 'minutes'}
                label="Min"
                value={issueDateDraft.getMinutes()}
                pad
              />
            </div>
            {/* <span className="bug-report-eyebrow">Approx</span> */}
          </div>
          <div className="bug-report-gesture-hints">
            {ISSUE_DATE_HINTS.map((hint) => (
              <Fragment key={hint.input}>
                <span className="bug-report-gesture-hint-input">
                  {hint.input}
                </span>
                <span className="bug-report-gesture-hint-dot" />
                <span className="bug-report-gesture-hint-action">
                  {hint.action}
                </span>
              </Fragment>
            ))}
          </div>
        </>
      );
    }

    if (reportScreen === ReportScreen.reportingBug) {
      switch (reportStatus) {
        case ReportStatus.fetching:
          return 'Please wait while we compile the necessary information';
        case ReportStatus.slowFetch:
          return 'This is taking longer than expected, please wait';
        case ReportStatus.submitting:
          return 'Sending Your report, this may take a moment';
      }
    }

    if (reportScreen === ReportScreen.submitted) {
      return (
        <>
          <div style={{ marginTop: '10px' }}>
            <span>Thanks for Your feedback</span>
          </div>
          <div style={{ marginTop: '10px' }}>
            <span>
              Your report has been generated with ticket number{' '}
              <strong>{ticketRef.current}</strong>. You can ask for information
              about it by contacting support.
            </span>
          </div>
        </>
      );
    }

    return '';
  }, [
    activeIssueDateField,
    issueDateDraft,
    reportScreen,
    reportStatus,
    selectedIssueTimestamp
  ]);

  const optionList = options.length > 0 && (
    <div
      className="settings-fixed-item-container"
      style={{ marginBottom: '50px' }}
    >
      {options.map((item, index) => {
        const width = item.useableWidthPercentage || 90;
        return (
          <div
            key={item.key}
            className={`settings-fixed-item settings-item ${
              index === activeIndex ? 'active-setting' : ''
            }`}
            style={{
              marginBottom: '5px',
              width: `${width}%`,
              paddingRight: `${90 - width}%`
            }}
          >
            <span className="settings-fixed-item-text">{item.label}</span>
          </div>
        );
      })}
    </div>
  );

  if (
    reportStatus === ReportStatus.submitting ||
    reportStatus === ReportStatus.fetching ||
    reportStatus === ReportStatus.slowFetch
  ) {
    return (
      <div className="bug-report-loading-screen">
        <div className="bug-report-loading">
          <BugReportAnimation
            phase={animationPhase}
            onFinished={handleFinishedAnimationEnd}
            size={100}
          />
          <span className="bug-report-loading-text">{message}</span>
        </div>
        {reportStatus !== ReportStatus.submitting && optionList}
      </div>
    );
  }

  // Failures are short and read as a notice, so they centre on the bubble panel
  // with the code on its own line for the user to quote back to support.
  if (reportStatus === ReportStatus.failed && failure) {
    return (
      <div className="bug-report-centered-screen">
        <div className="bug-report-centered-body">
          <div className="bug-report-error">
            <span className="bug-report-eyebrow">Something went wrong</span>
            <span className="bug-report-error-message">{failure.message}</span>
            {failure.note && (
              <span className="bug-report-error-note">{failure.note}</span>
            )}
            <span className="bug-report-error-note">
              {CONTACT_SUPPORT_NOTE}
            </span>
            <span className="bug-report-error-code">
              Error code {failure.code}
            </span>
          </div>
        </div>
        {optionList}
      </div>
    );
  }

  // The issue-date screens are a centred readout rather than wrapped prose, so
  // they skip the shaper floats and centre on the bubble panel instead.
  if (
    reportScreen === ReportScreen.reportSetup ||
    reportScreen === ReportScreen.selectIssueDate
  ) {
    return (
      <div className="bug-report-centered-screen">
        <div className="bug-report-centered-body">{message}</div>
        {optionList}
      </div>
    );
  }

  return (
    <div className="main-quick-settings settings-explanation-container">
      <div className="settings-explanation">
        {reportScreen === ReportScreen.contactInfo ? (
          <QrGeneratedImage
            size={240}
            value={SUPPORT_WEBSITE_URL}
            description="Scan to open Meticulous contact information"
          />
        ) : (
          <>
            <div className="settings-explanation-shaper-left" />
            <div className="settings-explanation-shaper-right" />
            {/* <span className="bug-report-message">{message}</span> */}
            <div>{message}</div>
          </>
        )}
      </div>
      {optionList}
    </div>
  );
};
