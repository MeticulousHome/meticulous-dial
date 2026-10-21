import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
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

import { DraftInfo } from '@meticulous-home/espresso-api';

import { api } from '../../api/api';
import { useIdleTimer } from '../../hooks/useIdleTimer';
import { useSettings, useUpdateSettings } from '../../hooks/useSettings';
import { TICKET_SERVICE_URL } from '../../sentryConfig';
import { contactEmailEdit } from './contactEmailEdit';
import {
  cancelCollection,
  CollectionRun,
  startCollection
} from './reportCollection';
import { holdRun, reportHandoff } from './reportHandoff';
import { ownReport } from './ownReport';
import {
  cancelledError,
  isCancelledError,
  reportApiError,
  reportErrorCode,
  TOO_LATE_TO_CANCEL,
  UNKNOWN_LOCAL_ID,
  watchForCancel
} from './reportProgressErrors';
import {
  cancelReport,
  postReportProgress,
  syncReportProgress
} from './reportProgressApi';
import { reportProgressStore } from './reportProgressStore';
import type { ReportProgress } from './reportProgressTypes';
import { ReportProgressView } from './ReportProgressView';
import { clampIndex } from './reportProgressView';
import { useReportProgress } from './useReportProgress';
import {
  buildDraftAttachment,
  captureException,
  FAILURE_DETAILS,
  FailureView,
  getTicketEventID,
  isOfflineError,
  isReportError,
  sendSentryFeedback,
  SubmissionFailType,
  withRetry
} from './reportSubmission';

import './bugReport.css';

enum ReportScreen {
  message = 'message',
  reportSetup = 'reportSetup',
  selectIssueDate = 'selectIssueDate',
  reportingBug = 'reportingBug',
  contactUs = 'contactUs',
  yourContactInfo = 'yourContactInfo',
  submitted = 'submitted',
  /** Where a report stands, from the machine; never blocks the bubble. */
  progress = 'progress'
}

enum ReportStatus {
  idle = 'idle',
  fetching = 'fetching',
  slowFetch = 'slowFetch',
  submitting = 'submitting',
  failed = 'failed',
  /** The report was cancelled from the mobile app while this one sent it. */
  cancelled = 'cancelled'
}

type SubmissionStateType =
  | null
  | 'fetchingFile'
  | 'buildingFeedback'
  | 'ticketing'
  | 'updatingReport'
  | 'sendingFeedback'
  | 'savingRecord';

const CONTACT_SUPPORT_NOTE = 'Please contact us for further information.';

// The submitted screen waits on the closing animation. A dropped 'complete'
// event would strand the user on a screen that offers no options at all, so the
// wait is capped. A submission landing at the worst moment queues behind the
// collecting loop's boundary (up to 2.0s), the bridge (2.4s) and Finished
// itself (1.1s), so the cap has to clear 5.5s with room for a slow frame rate.
const FINISHED_ANIMATION_TIMEOUT = 12 * 1000;

type SubmissionOutcome = {
  ticket: number | null;
  failure: FailureView | null;
  /** Cancelled from the mobile app, so neither sent nor failed. */
  cancelled?: boolean;
};

type InFlightSubmission = {
  localID: string;
  outcome: Promise<SubmissionOutcome>;
};

// A bubble can be unmounted by navigation while delivery continues. Keep the
// result outside the component so the next mount can show it.
let inFlightSubmission: InFlightSubmission | null = null;

type BugReportOption = {
  key:
    | 'yourContactInfo'
    | 'editContactEmail'
    | 'removeContactEmail'
    | 'contactUs'
    | 'reportIssue'
    | 'report'
    | 'selectDate'
    | 'back'
    | 'cancel'
    | 'exit';
  label: string;
  useableWidthPercentage: number;
  /** Runs on a held press, with the slide-away fill, never on a plain press. */
  hold?: boolean;
};

// A held press on a `hold` option: the fill runs on press down, the action
// fires when it completes and an early release cancels it (quick settings do
// the same).
type HoldAnimationState = 'stopped' | 'running' | 'finished';

type IssueDateField = 'day' | 'month' | 'year' | 'hours' | 'minutes';

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

const SUPPORT_WEBSITE_URL = 'https://meticuloushome.com/pages/contact';

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
  // Quick settings ask for the progress view of a report that is running
  // (the entry reads "Reporting an issue"): the oldest one not over, unless
  // the Dial's own quick report is running, whose blocking flow shows instead.
  // Only read here; the request is consumed by the mount effect below.
  const viewRequestedRef = useRef(reportProgressStore.peekViewRequest());
  const [initialViewID] = useState<string | null>(() => {
    if (!viewRequestedRef.current || ownReport.isRunning()) return null;
    return reportProgressStore.pickActive()?.localID ?? null;
  });
  const [viewedID, setViewedID] = useState(initialViewID);
  const [endedReport, setEndedReport] = useState<ReportProgress | null>(null);
  const [cancelRefused, setCancelRefused] = useState(false);
  const cancellingRef = useRef(false);
  const [reportScreen, setReportScreen] = useState(
    initialViewID ? ReportScreen.progress : ReportScreen.message
  );
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
  const activeCreateRunRef = useRef<CollectionRun | null>(null);
  const submitControllerRef = useRef<AbortController | null>(null);
  const finishedResolveRef = useRef<(() => void) | null>(null);
  const { resetTimer: resetIdleTimer } = useIdleTimer();
  const { data: settings } = useSettings();
  const updateSettings = useUpdateSettings();
  // The address on file; "Your contact info" and the report legend show it.
  const savedEmail = settings?.report_contact_mail?.trim() || null;
  const [holdAnimation, setHoldAnimation] =
    useState<HoldAnimationState>('stopped');
  // The email the current report goes out with: the saved setting, or what
  // the user answered on the contact email screen. null once declined.
  const contactEmailRef = useRef<string | null>(null);

  const busy =
    reportStatus === ReportStatus.fetching ||
    reportStatus === ReportStatus.slowFetch ||
    reportStatus === ReportStatus.submitting;

  // The progress view shows the report the machine lists, until it ends: the
  // ending is kept here, shown once, and dropped from the store.
  const viewedProgress = useReportProgress(viewedID);
  const progressEntry = endedReport ?? viewedProgress;
  const canCancel =
    !!progressEntry &&
    !progressEntry.final &&
    progressEntry.cancellable &&
    !cancelRefused;

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
        ...(savedEmail
          ? [
              {
                key: 'yourContactInfo' as const,
                label: 'Your contact info',
                useableWidthPercentage: 81
              }
            ]
          : []),
        {
          key: 'contactUs',
          label: 'Contact us',
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

    if (reportScreen === ReportScreen.contactUs) {
      return [{ key: 'back', label: 'Back', useableWidthPercentage: 81 }];
    }

    if (reportScreen === ReportScreen.progress) {
      if (progressEntry?.final) {
        return [{ key: 'exit', label: 'Exit', useableWidthPercentage: 81 }];
      }
      return [
        ...(canCancel
          ? [
              {
                key: 'cancel' as const,
                label: 'Cancel',
                useableWidthPercentage: 81
              }
            ]
          : []),
        { key: 'back', label: 'Back', useableWidthPercentage: 81 }
      ];
    }

    if (reportScreen === ReportScreen.yourContactInfo) {
      return [
        ...(savedEmail
          ? [
              {
                key: 'editContactEmail' as const,
                label: savedEmail,
                useableWidthPercentage: 81
              },
              {
                key: 'removeContactEmail' as const,
                label: 'Remove contact info',
                useableWidthPercentage: 81,
                hold: true
              }
            ]
          : []),
        { key: 'back', label: 'Back', useableWidthPercentage: 81 }
      ];
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

    if (
      reportScreen === ReportScreen.submitted ||
      reportStatus === ReportStatus.cancelled
    ) {
      return [{ key: 'exit', label: 'Exit', useableWidthPercentage: 81 }];
    }

    return [];
  }, [canCancel, progressEntry?.final, reportScreen, reportStatus, savedEmail]);

  // The list can shrink under the cursor (Cancel goes away, the report ends).
  const selectedIndex = clampIndex(activeIndex, options.length);
  useEffect(() => {
    if (selectedIndex !== activeIndex) setActiveIndex(selectedIndex);
  }, [activeIndex, selectedIndex]);

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
    // Once the report has a draft the apps follow it, so tell them it failed.
    // Best effort; a failure before the draft is the backend's to report. Not
    // when only the record failed: Sentry has the report, and the apps would
    // say it failed while this screen says the ticket was received.
    const localID = draftInfoRef.current?.localID;
    if (localID && failureType !== 'submissionMark')
      void postReportProgress(localID, { failed: { code, message } });
  };

  // The mobile app cancelled the report this Dial is sending (or collecting):
  // same ending as the Dial's own Cancel, with its own outcome on screen.
  const showCancelled = () => {
    submissionStateRef.current = null;
    activeCreateRunRef.current = null;
    setIsFinishing(false);
    setFailure(null);
    setReportScreen(ReportScreen.reportingBug);
    setReportStatus(ReportStatus.cancelled);
    setActiveIndex(0);
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
    contactEmailRef.current = null;
  };

  const cancelCreateReport = () => {
    const run = activeCreateRunRef.current;
    if (!run) return;
    cancelCollection(run);
    activeCreateRunRef.current = null;
    resetCancelledReport();
  };

  // Shows a collection run and carries on with its outcome. Used for a run
  // started here and for one picked back up after the contact email screen.
  const attachCollection = (run: CollectionRun) => {
    setReportScreen(ReportScreen.reportingBug);
    setReportStatus(run.slow ? ReportStatus.slowFetch : ReportStatus.fetching);
    setActiveIndex(0);
    setFailure(null);
    setIsFinishing(false);
    draftInfoRef.current = null;

    run.onSlow = () => {
      if (activeCreateRunRef.current === run) {
        setReportStatus(ReportStatus.slowFetch);
      }
    };

    // A bubble that closed for the contact email screen let go of the run;
    // the mount that picked it up handles the outcome instead.
    holdRun(activeCreateRunRef, run, (outcome) => {
      run.onSlow = null;
      // Cancelled: the UI was already reset by cancelCreateReport.
      if (!outcome) return;
      if ('cancelled' in outcome) {
        showCancelled();
        return;
      }
      if ('failure' in outcome) {
        failSubmission(outcome.failure, outcome.error);
        return;
      }
      draftInfoRef.current = outcome.draft;
      setReportStatus(ReportStatus.submitting);
      void submitReport(outcome.draft);
    });
  };

  const beginReport = () => {
    const knownEmail = savedEmail;
    contactEmailRef.current = knownEmail;
    const run = startCollection(selectedIssueTimestamp);
    attachCollection(run);
    if (knownEmail !== null) return;

    // No address on file: ask for one on a full screen while the machine
    // collects. The run outlives this bubble and is picked up again when the
    // contact email screen reopens it. This bubble lets go of it now, as it
    // still renders through its closing animation.
    reportHandoff.detach(activeCreateRunRef);
    // The bubble closes now but the machine keeps collecting: still the
    // Dial's own report.
    ownReport.set('handoff', true);
    // Gestures stay blocked until the bubble has closed, so the release of
    // this press cannot type on the keyboard.
    dispatch(
      setBubbleDisplay({
        visible: false,
        component: undefined,
        interceptsGesture: true
      })
    );
    dispatch(setScreen('reportContactEmail'));
  };

  // "Your contact info": change the saved address on the full screen route.
  // The bubble comes back on that screen once the edit is saved or dropped.
  const editContactEmail = (email: string) => {
    contactEmailEdit.open(email);
    dispatch(
      setBubbleDisplay({
        visible: false,
        component: undefined,
        interceptsGesture: true
      })
    );
    dispatch(setScreen('reportContactEmail'));
  };

  // The hold on "Remove contact info" ran to the end: forget the address and
  // go back to the main screen, where its entry has gone.
  const handleHoldAnimationEnd = () => {
    setHoldAnimation('finished');
    const activeOption = options[selectedIndex];
    if (activeOption?.key !== 'removeContactEmail') return;
    updateSettings.mutate(
      { report_contact_mail: null },
      {
        onSuccess: () => {
          setReportScreen(ReportScreen.message);
          setActiveIndex(0);
        }
      }
    );
  };

  // Quick settings read this to tell the Dial's own report from one the mobile
  // app started; the bubble is closed (and unmounted) while it hands over.
  useEffect(() => {
    ownReport.set('bubble', busy);
    return () => ownReport.set('bubble', false);
  }, [busy]);

  useEffect(() => {
    dispatch(setBubblePinned(busy));
    if (!busy) return;
    resetIdleTimer();
    const keepAlive = setInterval(resetIdleTimer, 30_000);
    return () => clearInterval(keepAlive);
  }, [busy, dispatch, resetIdleTimer]);

  // Back from the contact email screen: resume the run left behind with the
  // address the user gave, if any.
  useEffect(() => {
    // The progress view request, if any, has been honoured by the first render.
    reportProgressStore.takeViewRequest();
    // Back from changing the saved address: reopen where it was pressed.
    if (contactEmailEdit.takeReturn()) {
      setReportScreen(ReportScreen.yourContactInfo);
      setActiveIndex(0);
    }
    ownReport.set('handoff', false);
    const run = reportHandoff.takeRun();
    const decision = reportHandoff.takeContactDecision();
    if (!run) return;
    contactEmailRef.current = decision?.email ?? null;
    attachCollection(run);
  }, []);

  useEffect(
    () => () => {
      // A run handed over for the contact email screen is no longer held
      // here; it keeps collecting for the bubble that comes back.
      const run = activeCreateRunRef.current;
      if (run) {
        cancelCollection(run);
        run.onSlow = null;
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
    let resolveOutcome: (value: SubmissionOutcome) => void;
    const outcome = new Promise<SubmissionOutcome>((resolve) => {
      resolveOutcome = resolve;
    });
    const submission = { localID: draftInfo.localID, outcome };
    inFlightSubmission = submission;
    let outcomeFailure: FailureView | null = null;
    let outcomeCancelled = false;
    ownReport.set('submission', true);
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

    // The mobile app can cancel until the upload starts. The machine tells it
    // here, or answers 409 REPORT_CANCELLED to the next call.
    const stopWatching = watchForCancel(draftInfo.localID, () => {
      outcomeCancelled = true;
      controller.abort();
      showCancelled();
    });

    try {
      setSubmissionStage('ticketing');
      // Best effort: only a cancel stops the report here.
      if (
        (await postReportProgress(
          draftInfo.localID,
          { stage: 'ticketing' },
          signal
        )) === 'cancelled'
      ) {
        throw cancelledError();
      }
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
      if (isReportError(reportInfo)) throw reportApiError(reportInfo);

      setSubmissionStage('fetchingFile');
      const draftFile = await api.getDraftReport(draftInfo.localID, { signal });
      if (isReportError(draftFile)) throw reportApiError(draftFile);

      setSubmissionStage('buildingFeedback');
      const attachment = buildDraftAttachment(draftFile);

      // Right before Sentry gets it, a cancel is still possible: this is the
      // last point where it is honoured.
      if (
        (await postReportProgress(
          draftInfo.localID,
          { stage: 'uploading' },
          signal
        )) === 'cancelled'
      ) {
        throw cancelledError();
      }

      setSubmissionStage('sendingFeedback');
      // Single attempt on purpose: captureFeedback is create-only, so a retry
      // after an ambiguous transport result (no response / timeout) files a
      // brand-new duplicate report rather than re-sending this one.
      const eventID = await sendSentryFeedback({
        reportInfo,
        attachment,
        signal,
        contact: { email: contactEmailRef.current }
      });

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
        throw reportApiError(markSubmittedResponse);
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

      if (isCancelledError(error)) {
        outcomeCancelled = true;
        showCancelled();
      } else if (submissionStateRef.current === 'sendingFeedback') {
        failSubmission('sentrySubmission', error);
        outcomeFailure = FAILURE_DETAILS.sentrySubmission;
      } else if (submissionStateRef.current === 'ticketing') {
        const failure = isOfflineError(error)
          ? 'offline'
          : 'TicketTrackRequest';
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
      stopWatching();
      ownReport.set('submission', false);
      if (submitControllerRef.current === controller)
        submitControllerRef.current = null;
      resolveOutcome!({
        ticket: ticketRef.current,
        failure: outcomeFailure,
        cancelled: outcomeCancelled
      });
      if (inFlightSubmission === submission) inFlightSubmission = null;
    }
  };

  useEffect(() => {
    const pending = inFlightSubmission;
    if (!pending) return;
    let disposed = false;
    setReportScreen(ReportScreen.reportingBug);
    setReportStatus(ReportStatus.submitting);
    void pending.outcome.then(
      ({ ticket, failure: pendingFailure, cancelled }) => {
        if (disposed) return;
        ticketRef.current = ticket;
        if (cancelled) {
          setReportStatus(ReportStatus.cancelled);
        } else if (pendingFailure) {
          setFailure(pendingFailure);
          setReportStatus(ReportStatus.failed);
        } else {
          setReportScreen(ReportScreen.submitted);
          setReportStatus(ReportStatus.idle);
        }
      }
    );
    return () => {
      disposed = true;
    };
  }, []);

  // The viewed report ended: keep it to show and let the store forget it.
  useEffect(() => {
    if (reportScreen !== ReportScreen.progress || !viewedProgress?.final) {
      return;
    }
    setEndedReport(viewedProgress);
    reportProgressStore.acknowledge(viewedProgress.localID);
  }, [reportScreen, viewedProgress]);

  // A report the machine no longer lists (a restart forgot it) has nothing
  // left to show: the usual start of the bubble.
  useEffect(() => {
    if (reportScreen === ReportScreen.progress && !progressEntry) {
      setReportScreen(ReportScreen.message);
      setViewedID(null);
      setActiveIndex(0);
    }
  }, [progressEntry, reportScreen]);

  // Cancel in the progress view. Cancelling twice is not an error for the
  // machine, and the answer (or the event) turns the view into the ending.
  const cancelViewedReport = async () => {
    if (!viewedID || cancellingRef.current) return;
    cancellingRef.current = true;
    try {
      const result = await cancelReport(viewedID);
      if (isReportError(result)) {
        const code = reportErrorCode(result);
        if (code === TOO_LATE_TO_CANCEL) {
          setCancelRefused(true);
        } else if (code === UNKNOWN_LOCAL_ID) {
          // The machine forgot it (a restart): the list drops it, and with it
          // this view.
          void syncReportProgress();
        } else {
          console.warn('[bug-report] cancel failed', result);
        }
        return;
      }
      reportProgressStore.apply(result);
    } finally {
      cancellingRef.current = false;
    }
  };

  useHandleGestures({
    left() {
      if (reportScreen === ReportScreen.selectIssueDate) {
        changeIssueDate(-1);
        return;
      }
      if (options.length === 0) return;
      setActiveIndex((prev) =>
        Math.max(clampIndex(prev, options.length) - 1, 0)
      );
    },
    right() {
      if (reportScreen === ReportScreen.selectIssueDate) {
        changeIssueDate(1);
        return;
      }
      if (options.length === 0) return;
      setActiveIndex((prev) =>
        Math.min(clampIndex(prev, options.length) + 1, options.length - 1)
      );
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
      const activeOption = options[selectedIndex];
      if (!activeOption || reportStatus === ReportStatus.submitting) return;
      if (activeOption.hold) {
        setHoldAnimation('running');
        return;
      }

      switch (activeOption.key) {
        case 'yourContactInfo':
          setReportScreen(ReportScreen.yourContactInfo);
          setReportStatus(ReportStatus.idle);
          setActiveIndex(0);
          break;
        case 'editContactEmail':
          if (savedEmail) editContactEmail(savedEmail);
          break;
        case 'contactUs':
          setReportScreen(ReportScreen.contactUs);
          setReportStatus(ReportStatus.idle);
          setActiveIndex(0);
          break;
        case 'reportIssue':
          setReportScreen(ReportScreen.reportSetup);
          setReportStatus(ReportStatus.idle);
          setActiveIndex(0);
          break;
        case 'report':
          beginReport();
          break;
        case 'selectDate':
          openIssueDateSelector();
          break;
        case 'cancel':
          if (reportScreen === ReportScreen.progress) {
            void cancelViewedReport();
          } else {
            cancelCreateReport();
          }
          break;
        case 'back':
          if (reportScreen === ReportScreen.progress) {
            exitToQuickSettings();
            break;
          }
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
    pressUp() {
      // Released: a finished hold already acted, an unfinished one is off.
      setHoldAnimation('stopped');
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
          <div style={{ marginTop: '6px' }}>
            <span>
              This action will send debug data and provide You with a{' '}
              <strong>bug report number</strong>.
            </span>
          </div>
          <div style={{ marginTop: '6px' }}>
            <span>
              Click on <strong>contact us</strong> to display QR coded contact
              information or <strong>report an issue</strong> to continue.
            </span>
          </div>
          <div style={{ marginTop: '6px' }}>
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
          {savedEmail && (
            <span className="bug-report-contact-legend">
              We will reach you back at {savedEmail}
            </span>
          )}
        </>
      );
    }

    if (reportScreen === ReportScreen.yourContactInfo) {
      return (
        <>
          <span className="bug-report-eyebrow">Your contact info</span>
          <p className="bug-report-copy">
            We reach you back about your reports at the address below. Press it
            to change it, or hold the option under it to forget it.
          </p>
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
    savedEmail,
    selectedIssueTimestamp
  ]);

  const optionList = options.length > 0 && (
    <div
      className="settings-fixed-item-container bug-report-options"
      style={{
        // "Your contact info" sits higher, clear of the display's curve.
        marginBottom:
          reportScreen === ReportScreen.yourContactInfo ? '80px' : '50px'
      }}
    >
      {options.map((item, index) => {
        const width = item.useableWidthPercentage || 90;
        const active = index === selectedIndex;
        const holding = active && item.hold && holdAnimation === 'running';
        return (
          <div
            key={item.key}
            className={`settings-fixed-item settings-item ${
              active ? 'active-setting' : ''
            } ${holding ? 'bug-report-option-holding' : ''}`}
            style={{
              marginBottom: '3px',
              width: `${width}%`,
              paddingRight: `${90 - width}%`
            }}
            onAnimationEnd={holding ? handleHoldAnimationEnd : undefined}
          >
            <span
              className={`settings-fixed-item-text ${
                item.key === 'editContactEmail'
                  ? 'bug-report-option-address'
                  : ''
              }`}
            >
              {item.label}
            </span>
            {item.hold && <span className="bug-report-option-badge">HOLD</span>}
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

  // Cancelled from the mobile app while this Dial was sending the report.
  if (reportStatus === ReportStatus.cancelled) {
    return (
      <div className="bug-report-centered-screen">
        <div className="bug-report-centered-body">
          <span className="bug-report-progress-stage">Report cancelled</span>
        </div>
        {optionList}
      </div>
    );
  }

  // Where a report stands. Not busy, so the bubble is never pinned.
  if (reportScreen === ReportScreen.progress && progressEntry) {
    return (
      <div className="bug-report-centered-screen">
        <div className="bug-report-centered-body">
          <ReportProgressView
            progress={progressEntry}
            notCancellable={!canCancel}
          />
        </div>
        {optionList}
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
    reportScreen === ReportScreen.selectIssueDate ||
    reportScreen === ReportScreen.yourContactInfo
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
        {reportScreen === ReportScreen.contactUs ? (
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
