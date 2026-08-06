import { Fragment, useMemo, useRef, useState } from 'react';
import { ZstdDec, ZstdInit } from '@oneidentity/zstd-js/decompress';
import * as Sentry from '@sentry/react';
import { AnimatedCounter } from 'react-animated-counter/dist/esm';
import { useHandleGestures } from '../../hooks/useHandleGestures';
import { LoadingScreen } from '../LoadingScreen/LoadingScreen';
import { QrGeneratedImage } from '../QR/QrImage';
import {
  setBubbleDisplay,
  setScreen
} from '../store/features/screens/screens-slice';
import { useAppDispatch, useAppSelector } from '../store/hooks';

import {
  ReportInfo,
  DraftInfo,
  MeticulousIDRequestType
} from '@meticulous-home/espresso-api';

import { api } from '../../api/api';

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
  fetched = 'fetched',
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
  | 'reportLoad';

type SubmissionStateType =
  | null
  | 'fetchingFile'
  | 'decompressing'
  | 'buildingFeedback'
  | 'ticketing'
  | 'updatingReport'
  | 'sendingFeedback'
  | 'savingRecord';

type BugReportOption = {
  key:
    | 'contactInfo'
    | 'reportIssue'
    | 'report'
    | 'selectDate'
    | 'back'
    | 'submit'
    | 'exit';
  label: string;
  useableWidthPercentage: number;
};

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
const service_url =
  'https://a3qhsgqqfk.execute-api.us-east-1.amazonaws.com/Prod/ticket';

const textDecoder = new TextDecoder();

const reportSubmissionError =
  'failed to submit the report. Please contact us for further information';

const captureException = (error: unknown) => {
  console.error(error);
  if (Sentry.isInitialized()) {
    Sentry.captureException(error);
  }
};

const readTarString = (data: Uint8Array, start: number, length: number) => {
  const slice = data.slice(start, start + length);
  const end = slice.indexOf(0);
  return textDecoder.decode(end >= 0 ? slice.slice(0, end) : slice).trim();
};

const readTarSize = (data: Uint8Array, offset: number) => {
  const sizeText = readTarString(data, offset + 124, 12);
  return Number.parseInt(sizeText || '0', 8);
};

const isEmptyTarBlock = (data: Uint8Array, offset: number) => {
  for (
    let index = offset;
    index < offset + 512 && index < data.length;
    index++
  ) {
    if (data[index] !== 0) return false;
  }
  return true;
};

const untar = (data: Uint8Array): DraftFile[] => {
  const files: DraftFile[] = [];
  let offset = 0;

  while (offset + 512 <= data.length && !isEmptyTarBlock(data, offset)) {
    const name = readTarString(data, offset, 100);
    const prefix = readTarString(data, offset + 345, 155);
    const typeFlag = readTarString(data, offset + 156, 1);
    const size = readTarSize(data, offset);
    const fileStart = offset + 512;
    const fileEnd = fileStart + size;

    if (name && (!typeFlag || typeFlag === '0')) {
      const filename = prefix ? `${prefix}/${name}` : name;
      files.push({
        name: filename,
        data: data.slice(fileStart, fileEnd),
        contentType: getContentType(filename)
      });
    }

    offset = fileStart + Math.ceil(size / 512) * 512;
  }

  return files;
};

const decompressReportDraft = async (compressed: Uint8Array) => {
  const { ZstdSimple, ZstdStream }: ZstdDec = await ZstdInit();

  try {
    return ZstdSimple.decompress(compressed);
  } catch {
    return ZstdStream.decompress(compressed);
  }
};

const parseReportFiles = async (compressed: Uint8Array) => {
  const decompressed = await decompressReportDraft(compressed);
  const files = untar(decompressed);

  if (files.length > 0) {
    return files;
  }

  throw new Error('Report draft did not contain a readable tar archive');
};

const parseReportInfo = (files: DraftFile[]): ReportInfo => {
  const reportInfoFile = files.find(
    (file) => file.name.split('/').pop() === 'report_info.json'
  );

  if (!reportInfoFile) {
    throw new Error('report_info.json missing from report draft');
  }

  return JSON.parse(textDecoder.decode(reportInfoFile.data));
};

const reportInfoTags = (reportInfo: ReportInfo) => {
  return Object.fromEntries(
    Object.entries(reportInfo)
      .filter(([, value]) => value !== null && value !== undefined)
      .map(([key, value]) => [
        key,
        typeof value === 'object' ? JSON.stringify(value) : String(value)
      ])
  );
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
  attachment
}: {
  reportInfo: ReportInfo;
  attachment: DraftFile;
}) => {
  if (!Sentry.isInitialized()) {
    throw new Error('Sentry is not initialized');
  }

  const eventID = Sentry.captureFeedback(
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
          'meticulous.report_source': 'dial'
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

  const sent = await Sentry.flush(10_000);
  if (!sent) {
    throw new Error('Sentry feedback flush timed out');
  }

  return eventID;
};

const IssueDateCounter = ({
  active,
  value,
  pad = false
}: {
  active: boolean;
  value: number;
  /** Keeps two-digit fields two digits wide, so the row never shifts. */
  pad?: boolean;
}) => (
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
);

export const BugReport = (): JSX.Element => {
  const dispatch = useAppDispatch();
  const currentScreen = useAppSelector((state) => state.screen.value);
  const previousScreen = useAppSelector((state) => state.screen.prev);
  const [reportScreen, setReportScreen] = useState(ReportScreen.message);
  const [reportStatus, setReportStatus] = useState(ReportStatus.idle);
  const [activeIndex, setActiveIndex] = useState(0);
  const [failureError, setFailureError] = useState('');
  const [selectedIssueTimestamp, setSelectedIssueTimestamp] = useState<
    number | undefined
  >();
  const [issueDateDraft, setIssueDateDraft] = useState(() => new Date());
  const [activeIssueDateField, setActiveIssueDateField] =
    useState<IssueDateField>('day');
  const draftInfoRef = useRef<DraftInfo | null>(null);
  const failureRef = useRef<SubmissionFailType | null>(null);
  const ticketRef = useRef<number | null>(null);
  const submissionStateRef = useRef<SubmissionStateType>(null);

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
      reportStatus === ReportStatus.fetched
    ) {
      return [
        { key: 'submit', label: 'Submit', useableWidthPercentage: 81 },
        { key: 'exit', label: 'Exit', useableWidthPercentage: 81 }
      ];
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

  const startCreateReport = async () => {
    setReportScreen(ReportScreen.reportingBug);
    setReportStatus(ReportStatus.fetching);
    setActiveIndex(0);
    failureRef.current = null;
    draftInfoRef.current = null;

    const slowTimeout = setTimeout(() => {
      setReportStatus(ReportStatus.slowFetch);
    }, 60 * 1000); // message change on the first minute mark

    try {
      const create_response =
        selectedIssueTimestamp === undefined
          ? await api.createReport()
          : await api.createReport({ issueTime: selectedIssueTimestamp });
      if (isReportError(create_response)) {
        throw Error(create_response.error);
      }
      draftInfoRef.current = create_response;
      setReportStatus(ReportStatus.fetched);
    } catch (error) {
      failureRef.current = 'creation';
      setFailureError(
        'There was an error while getting the necessary information, You may contact us for further instructions'
      );
      setReportStatus(ReportStatus.failed);
      captureException(error);
    } finally {
      clearTimeout(slowTimeout);
    }
  };

  const openIssueDateSelector = () => {
    setIssueDateDraft(
      new Date(
        selectedIssueTimestamp === undefined
          ? Date.now()
          : selectedIssueTimestamp * 1000
      )
    );
    setActiveIssueDateField('day');
    setActiveIndex(0);
    setReportScreen(ReportScreen.selectIssueDate);
  };

  const changeIssueDate = (direction: number) => {
    setIssueDateDraft((previousDate) => {
      const nextDate = new Date(previousDate.getTime());

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
          nextDate.setMinutes(nextDate.getMinutes() + direction);
          break;
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

  const failSubmission = (
    failure: SubmissionFailType,
    errorMessage: string,
    error: unknown
  ) => {
    failureRef.current = failure;
    setFailureError(errorMessage);
    setReportStatus(ReportStatus.failed);
    submissionStateRef.current = null;
    captureException(error);
  };

  const setSubmissionStage = (stage: SubmissionStateType) => {
    submissionStateRef.current = stage;
  };

  const submitReport = async () => {
    const draftInfo = draftInfoRef.current;
    if (!draftInfo?.localID) {
      failSubmission('reportLoad', reportSubmissionError, 'No draft report');
      return;
    }

    setReportStatus(ReportStatus.submitting);
    failureRef.current = null;

    let timedOut = false;
    const submissionTimeout = setTimeout(
      () => {
        timedOut = true;
        failSubmission(
          'submissionTimeout',
          reportSubmissionError,
          'Report submission timed out'
        );
      },
      5 * 60 * 1000
    ); // 5 minutes timeout

    try {
      setSubmissionStage('ticketing');
      const ticketPayload: MeticulousIDRequestType = {
        eventID: getTicketEventID(draftInfo)
      };
      const ticket = await api.getMeticulousReportTracking(
        service_url,
        ticketPayload
      );
      if (isReportError(ticket)) throw Error(ticket.error);
      ticketRef.current = ticket;
      if (timedOut) return;

      setSubmissionStage('updatingReport');
      const updateResponse = await api.updateReport(draftInfo.localID, {
        ticket
      });
      if (isReportError(updateResponse)) throw Error(updateResponse.error);
      if (timedOut) return;

      setSubmissionStage('fetchingFile');
      const draftFile = await api.getDraftReport(draftInfo.localID);
      if (isReportError(draftFile)) throw Error(draftFile.error);
      if (timedOut) return;

      setSubmissionStage('decompressing');
      const files = await parseReportFiles(draftFile);
      if (timedOut) return;

      setSubmissionStage('buildingFeedback');
      const reportInfo = parseReportInfo(files);
      const attachment = buildDraftAttachment(draftFile);
      reportInfo.ticket = ticket;
      if (timedOut) return;

      setSubmissionStage('sendingFeedback');
      const eventID = await sendSentryFeedback({ reportInfo, attachment });
      if (timedOut) return;

      setSubmissionStage('savingRecord');
      const markSubmittedResponse = await api.markSubmittedReport({
        localID: draftInfo.localID,
        eventID,
        ticket,
        submissionTime: Math.floor(Date.now() / 1000)
      });
      if (isReportError(markSubmittedResponse)) {
        throw Error(markSubmittedResponse.error);
      }
      if (timedOut) return;

      setSubmissionStage(null);
      setReportScreen(ReportScreen.submitted);
      setReportStatus(ReportStatus.idle);
    } catch (error) {
      if (timedOut) return;

      if (submissionStateRef.current === 'sendingFeedback') {
        failSubmission('sentrySubmission', reportSubmissionError, error);
      } else if (submissionStateRef.current === 'ticketing') {
        failSubmission(
          'TicketTrackRequest',
          'Failed getting ticket number. Please contact us for further information',
          error
        );
      } else if (submissionStateRef.current === 'updatingReport') {
        failSubmission(
          'reportUpdate',
          `failed to link ticket number with report. Please contact us for further information`,
          error
        );
      } else if (submissionStateRef.current === 'savingRecord') {
        failSubmission(
          'submissionMark',
          `failed to update your reports record, dont worry we received the ticket with number ${ticketRef.current}, save the ticket number for further tracking. Please contact us for further information`,
          error
        );
      } else {
        failSubmission('reportLoad', reportSubmissionError, error);
      }
    } finally {
      clearTimeout(submissionTimeout);
    }
  };

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
        case 'submit':
          submitReport();
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
            <span>{formatIssueDate(reportDate)}</span>
            <span>{formatIssueTime(reportDate)}</span>
          </div>
        </>
      );
    }

    if (reportScreen === ReportScreen.selectIssueDate) {
      return (
        <>
          <span className="bug-report-eyebrow">
            Select issue date &amp; time
          </span>
          <div className="bug-report-date-picker">
            <div className="bug-report-date-picker-row">
              <IssueDateCounter
                active={activeIssueDateField === 'day'}
                value={issueDateDraft.getDate()}
                pad
              />
              <span className="bug-report-date-picker-separator">.</span>
              <IssueDateCounter
                active={activeIssueDateField === 'month'}
                value={issueDateDraft.getMonth() + 1}
                pad
              />
              <span className="bug-report-date-picker-separator">.</span>
              <IssueDateCounter
                active={activeIssueDateField === 'year'}
                value={issueDateDraft.getFullYear()}
              />
            </div>
            <div className="bug-report-date-picker-row">
              <IssueDateCounter
                active={activeIssueDateField === 'hours'}
                value={issueDateDraft.getHours()}
                pad
              />
              <span className="bug-report-date-picker-separator">:</span>
              <IssueDateCounter
                active={activeIssueDateField === 'minutes'}
                value={issueDateDraft.getMinutes()}
                pad
              />
            </div>
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
        case ReportStatus.fetched:
          return (
            <>
              <div style={{ marginTop: '10px' }}>
                <span>We are almost done.</span>
              </div>
              <div style={{ marginTop: '10px' }}>
                <span>
                  Clicking on <strong>Submit</strong> will send us the ticket
                  and provide You with a report <strong>tracking number</strong>
                </span>
              </div>
            </>
          );
        case ReportStatus.failed:
          return failureError;
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
    failureError,
    issueDateDraft,
    reportScreen,
    reportStatus,
    selectedIssueTimestamp
  ]);

  if (
    reportStatus === ReportStatus.submitting ||
    reportStatus === ReportStatus.fetching ||
    reportStatus === ReportStatus.slowFetch
  ) {
    return (
      <div className="bug-report-loading settings-explanation-container">
        <div className="settings-explanation">
          <div className="settings-explanation-shaper-left" />
          <div className="settings-explanation-shaper-right" />
          {reportStatus !== ReportStatus.submitting && (
            <span className="bug-report-loading-text">{message}</span>
          )}
          <LoadingScreen />
        </div>
      </div>
    );
  }

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
