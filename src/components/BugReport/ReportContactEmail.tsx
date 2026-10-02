import { Fragment, useEffect, useMemo, useRef, useState } from 'react';

import { CircleKeyboard } from '../CircleKeyboard/CircleKeyboard';
import { useHandleGestures } from '../../hooks/useHandleGestures';
import { useIdleTimer } from '../../hooks/useIdleTimer';
import { useUpdateSettings } from '../../hooks/useSettings';
import {
  ScreenType,
  setBubbleDisplay,
  setScreen
} from '../store/features/screens/screens-slice';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { reportHandoff } from './reportCollection';

import './reportContactEmail.css';

/**
 * Full screen route opened by the bug report bubble the first time a report
 * is filed without a saved `report_contact_mail`. The machine collects the
 * report meanwhile (see reportCollection.ts). Keyboard for the part before
 * the "@", then a list of common domains or a keyboard for a custom one. A
 * long press (or the keyboard's abort key) backs out to a screen that says
 * we cannot reach back, with "Ok" or "Enter email" to return.
 *
 * Whatever the outcome, the route hands the answer to `reportHandoff` and
 * reopens the bubble, which resumes with the run it left behind.
 */

type Step = 'local' | 'domain' | 'custom' | 'declined';

type Draft = {
  localPart: string;
  /** The user typed an "@" themselves, so no domain is asked for. */
  customDomainEntered: boolean;
  domain: string;
};

const EMPTY_DRAFT: Draft = {
  localPart: '',
  customDomainEntered: false,
  domain: ''
};

const EMAIL_DOMAINS = [
  'gmail.com',
  'outlook.com',
  'proton.me',
  'hotmail.com',
  'icloud.com'
];
const CUSTOM_DOMAIN_LABEL = 'Custom';
const DOMAIN_OPTIONS = [...EMAIL_DOMAINS, CUSTOM_DOMAIN_LABEL];

const DECLINED_ACTIONS = [
  { key: 'ok', label: 'Ok' },
  { key: 'enterEmail', label: 'Enter email' }
] as const;

const DOMAIN_HINTS = [
  { input: 'Press', action: 'Select' },
  { input: 'Long press', action: 'Skip' }
];

const stripSpaces = (value: string) => value.replace(/\s+/g, '');

const looksLikeEmail = (value: string) => {
  const [localPart, domain, ...rest] = value.split('@');
  return rest.length === 0 && Boolean(localPart) && Boolean(domain);
};

export const ReportContactEmail = () => {
  const dispatch = useAppDispatch();
  const screen = useAppSelector((state) => state.screen);
  const bubbleDisplay = screen.bubbleDisplay;
  const updateSettings = useUpdateSettings();
  const { resetTimer: resetIdleTimer } = useIdleTimer();
  // The screen under the bubble when the report was started.
  const returnScreen = useRef<ScreenType>(screen.prev || 'profileHome');
  const [step, setStep] = useState<Step>('local');
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [activeIndex, setActiveIndex] = useState(0);
  // Where "Enter email" on the declined screen returns to.
  const declinedFrom = useRef<Step>('local');

  // The machine is collecting underneath; the dial must not go idle on it.
  useEffect(() => {
    resetIdleTimer();
    const keepAlive = setInterval(resetIdleTimer, 30_000);
    return () => clearInterval(keepAlive);
  }, [resetIdleTimer]);

  const finish = (email: string | null) => {
    if (email) {
      // Saved for next time regardless of how this report ends. A failed
      // save only costs asking again on the next report.
      updateSettings.mutate({ report_contact_mail: email });
    }
    reportHandoff.setContactDecision(email);
    dispatch(setScreen(returnScreen.current));
    dispatch(setBubbleDisplay({ visible: true, component: 'bug-report' }));
  };

  const decline = () => {
    if (step !== 'declined') declinedFrom.current = step;
    setActiveIndex(0);
    setStep('declined');
  };

  const submitLocalPart = (text: string) => {
    const localPart = stripSpaces(text);
    if (!localPart) return;
    if (localPart.includes('@')) {
      // They typed the whole address; no domain to pick.
      if (!looksLikeEmail(localPart)) return;
      setDraft((current) => ({
        ...current,
        localPart,
        customDomainEntered: true
      }));
      finish(localPart);
      return;
    }
    setDraft((current) => ({
      ...current,
      localPart,
      customDomainEntered: false
    }));
    setActiveIndex(0);
    setStep('domain');
  };

  const chooseDomain = (index: number) => {
    const choice = DOMAIN_OPTIONS[index];
    if (choice === CUSTOM_DOMAIN_LABEL) {
      setStep('custom');
      return;
    }
    finish(`${draft.localPart}@${choice}`);
  };

  const submitCustomDomain = (text: string) => {
    const domain = stripSpaces(text).replace(/^@+/, '');
    if (!domain || domain.includes('@')) return;
    setDraft((current) => ({ ...current, domain }));
    finish(`${draft.localPart}@${domain}`);
  };

  // The keyboard steps own the encoder; this only drives the two lists.
  const listLength =
    step === 'domain'
      ? DOMAIN_OPTIONS.length
      : step === 'declined'
        ? DECLINED_ACTIONS.length
        : 0;

  useHandleGestures(
    {
      left() {
        if (listLength === 0) return;
        setActiveIndex((prev) => Math.max(prev - 1, 0));
      },
      right() {
        if (listLength === 0) return;
        setActiveIndex((prev) => Math.min(prev + 1, listLength - 1));
      },
      pressDown() {
        if (step === 'domain') {
          chooseDomain(activeIndex);
        } else if (step === 'declined') {
          if (DECLINED_ACTIONS[activeIndex].key === 'ok') {
            finish(null);
          } else {
            setActiveIndex(0);
            setStep(declinedFrom.current);
          }
        }
      },
      longEncoder() {
        if (step === 'domain') decline();
      }
    },
    bubbleDisplay.interceptsGesture
  );

  // CircleKeyboard resets its caption whenever defaultValue changes identity,
  // so these are memoised on the text and not rebuilt every render.
  const localPartValue = useMemo(
    () => draft.localPart.split(''),
    [draft.localPart]
  );
  const domainValue = useMemo(() => draft.domain.split(''), [draft.domain]);

  if (step === 'local') {
    return (
      <CircleKeyboard
        name="email to reach you back"
        defaultValue={localPartValue}
        suffix={draft.customDomainEntered ? undefined : '@'}
        onChange={(text) =>
          setDraft((current) => ({
            ...current,
            localPart: text,
            customDomainEntered: text.includes('@')
          }))
        }
        onSubmit={submitLocalPart}
        onCancel={decline}
        onLongPress={decline}
        capitalizeFirstLetter={false}
      />
    );
  }

  if (step === 'custom') {
    return (
      <CircleKeyboard
        name={`domain for ${draft.localPart}`}
        defaultValue={domainValue}
        prefix="@"
        onChange={(text) =>
          setDraft((current) => ({ ...current, domain: text }))
        }
        onSubmit={submitCustomDomain}
        onCancel={decline}
        onLongPress={decline}
        capitalizeFirstLetter={false}
      />
    );
  }

  if (step === 'domain') {
    return (
      <div className="report-contact-screen">
        <span className="report-contact-eyebrow">Your email domain</span>
        <span className="report-contact-address">{draft.localPart}@</span>
        <div className="report-contact-grid">
          {DOMAIN_OPTIONS.map((domain, index) => (
            <div
              key={domain}
              className={`report-contact-option ${
                index === activeIndex ? 'active' : ''
              }`}
            >
              {domain === CUSTOM_DOMAIN_LABEL ? domain : `@${domain}`}
            </div>
          ))}
        </div>
        <div className="report-contact-hints">
          {DOMAIN_HINTS.map((hint) => (
            <Fragment key={hint.input}>
              <span className="report-contact-hint-input">{hint.input}</span>
              <span className="report-contact-hint-dot" />
              <span className="report-contact-hint-action">{hint.action}</span>
            </Fragment>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="report-contact-screen">
      <span className="report-contact-eyebrow">No contact email</span>
      <p className="report-contact-copy">
        Without an email address we will not be able to reach back to you about
        this report.
      </p>
      <div className="report-contact-actions">
        {DECLINED_ACTIONS.map((action, index) => (
          <div
            key={action.key}
            className={`report-contact-option ${
              index === activeIndex ? 'active' : ''
            }`}
          >
            {action.label}
          </div>
        ))}
      </div>
    </div>
  );
};
