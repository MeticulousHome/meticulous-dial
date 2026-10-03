import { Fragment, useEffect, useRef, useState } from 'react';

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
import { contactEmailEdit } from './contactEmailEdit';
import { reportHandoff } from './reportCollection';

import './reportContactEmail.css';

/**
 * Full screen route for the contact email, reached two ways.
 *
 * From the bug report bubble when a report is filed without a saved
 * `report_contact_mail`: the machine collects meanwhile (see
 * reportCollection.ts) and the answer goes back through `reportHandoff`. A
 * long press backs out to a screen that says we cannot reach back, with "Ok"
 * or "Enter email" to return.
 *
 * From the bubble's "Your contact info" screen, to change the saved address
 * (`contactEmailEdit`): starts on the confirm step with the address split up,
 * and a long press drops the edit.
 *
 * Steps: a keyboard for the part before the "@" (typing "@" or pressing ok
 * moves on), the list of common domains with "Custom" (keyboard with the "@"
 * prefix) and a backspace to the first keyboard, then a confirm step that
 * shows the whole address and lets the knob pick a part to edit again.
 */

type Step = 'local' | 'domain' | 'custom' | 'confirm' | 'declined';

type Draft = {
  localPart: string;
  domain: string;
};

const EMPTY_DRAFT: Draft = { localPart: '', domain: '' };

const EMAIL_DOMAINS = [
  'gmail.com',
  'outlook.com',
  'proton.me',
  'hotmail.com',
  'icloud.com'
];
const CUSTOM_DOMAIN_LABEL = 'Custom';
const BACKSPACE_LABEL = '⌫';
const DOMAIN_OPTIONS = [...EMAIL_DOMAINS, CUSTOM_DOMAIN_LABEL, BACKSPACE_LABEL];
const CUSTOM_DOMAIN_INDEX = DOMAIN_OPTIONS.indexOf(CUSTOM_DOMAIN_LABEL);
const BACKSPACE_INDEX = DOMAIN_OPTIONS.indexOf(BACKSPACE_LABEL);

// Encoder order on the confirm step, wrapping around at both ends.
const CONFIRM_FOCUS = ['ok', 'local', 'domain'] as const;

const DECLINED_ACTIONS = [
  { key: 'ok', label: 'Ok' },
  { key: 'enterEmail', label: 'Enter email' }
] as const;

type Hint = { input: string; action: string };

const stripSpaces = (value: string) => value.replace(/\s+/g, '');

const splitEmail = (email: string): Draft => {
  const at = email.indexOf('@');
  return at < 0
    ? { localPart: email, domain: '' }
    : { localPart: email.slice(0, at), domain: email.slice(at + 1) };
};

const isListedDomain = (domain: string) => EMAIL_DOMAINS.includes(domain);

// Where the encoder starts on the domain list: on the current choice.
const domainIndexFor = (domain: string) => {
  if (!domain) return 0;
  const index = EMAIL_DOMAINS.indexOf(domain);
  return index >= 0 ? index : CUSTOM_DOMAIN_INDEX;
};

const Hints = ({ hints }: { hints: Hint[] }) => (
  <div className="report-contact-hints">
    {hints.map((hint) => (
      <Fragment key={hint.input}>
        <span className="report-contact-hint-input">{hint.input}</span>
        <span className="report-contact-hint-dot" />
        <span className="report-contact-hint-action">{hint.action}</span>
      </Fragment>
    ))}
  </div>
);

export const ReportContactEmail = () => {
  const dispatch = useAppDispatch();
  const screen = useAppSelector((state) => state.screen);
  const bubbleDisplay = screen.bubbleDisplay;
  const updateSettings = useUpdateSettings();
  const { resetTimer: resetIdleTimer } = useIdleTimer();
  // The screen under the bubble when this was opened.
  const returnScreen = useRef<ScreenType>(screen.prev || 'profileHome');
  // Set when opened from "Your contact info" to change the saved address.
  const [edit] = useState(() => contactEmailEdit.take());
  const [step, setStep] = useState<Step>(edit ? 'confirm' : 'local');
  const [draft, setDraft] = useState<Draft>(() =>
    edit ? splitEmail(edit.email) : EMPTY_DRAFT
  );
  const [activeIndex, setActiveIndex] = useState(0);
  // What the keyboard on screen started with. CircleKeyboard resets its
  // caption to defaultValue whenever the identity changes, so this is only
  // replaced on entering a keyboard step, and to drop a stray "@".
  const [keyboardSeed, setKeyboardSeed] = useState<string[]>([]);
  // Where "Enter email" on the declined screen returns to.
  const declinedFrom = useRef<Step>('local');
  const saving = useRef(false);

  // The machine is collecting underneath; the dial must not go idle on it.
  useEffect(() => {
    if (edit) return;
    resetIdleTimer();
    const keepAlive = setInterval(resetIdleTimer, 30_000);
    return () => clearInterval(keepAlive);
  }, [edit, resetIdleTimer]);

  const returnToBubble = () => {
    dispatch(setScreen(returnScreen.current));
    dispatch(setBubbleDisplay({ visible: true, component: 'bug-report' }));
  };

  const finish = async (email: string | null) => {
    if (edit) {
      if (saving.current) return;
      saving.current = true;
      try {
        // Waited on so the bubble shows the new address when it comes back.
        await updateSettings.mutateAsync({ report_contact_mail: email });
      } catch {
        // Logged by the hook; the previous address stays on file.
      }
      contactEmailEdit.markReturn();
      returnToBubble();
      return;
    }
    if (email) {
      // Saved for next time regardless of how this report ends. A failed
      // save only costs asking again on the next report.
      updateSettings.mutate({ report_contact_mail: email });
    }
    reportHandoff.setContactDecision(email);
    returnToBubble();
  };

  // Long press, or the keyboard's cancel key. Reporting: offer to go on
  // without an address. Editing: drop the change.
  const bail = () => {
    if (edit) {
      contactEmailEdit.markReturn();
      returnToBubble();
      return;
    }
    if (step !== 'declined') declinedFrom.current = step;
    setActiveIndex(0);
    setStep('declined');
  };

  const openLocalPart = () => {
    setKeyboardSeed(draft.localPart.split(''));
    setStep('local');
  };

  const openDomainList = () => {
    setActiveIndex(domainIndexFor(draft.domain));
    setStep('domain');
  };

  // The custom keyboard starts from `seed`: a custom domain already on the
  // draft, or what was typed before a long press. Never a listed domain.
  const openCustomDomain = (seed: string) => {
    setDraft((current) => ({ ...current, domain: seed }));
    setKeyboardSeed(seed.split(''));
    setStep('custom');
  };

  const openConfirm = () => {
    setActiveIndex(0);
    setStep('confirm');
  };

  const localPartTyped = (text: string) => {
    if (!text.includes('@')) {
      setDraft((current) => ({ ...current, localPart: text }));
      return;
    }
    // "@" ends this part and moves on to the domain. On an empty address it
    // is dropped and the keyboard cleared instead.
    const localPart = stripSpaces(text.replace(/@/g, ''));
    setDraft((current) => ({ ...current, localPart }));
    if (!localPart) {
      setKeyboardSeed([]);
      return;
    }
    openDomainList();
  };

  const submitLocalPart = (text: string) => {
    const localPart = stripSpaces(text).replace(/@/g, '');
    if (!localPart) return;
    setDraft((current) => ({ ...current, localPart }));
    openDomainList();
  };

  const chooseDomainOption = (index: number) => {
    const choice = DOMAIN_OPTIONS[index];
    if (choice === BACKSPACE_LABEL) {
      openLocalPart();
      return;
    }
    if (choice === CUSTOM_DOMAIN_LABEL) {
      openCustomDomain(isListedDomain(draft.domain) ? '' : draft.domain);
      return;
    }
    setDraft((current) => ({ ...current, domain: choice }));
    openConfirm();
  };

  const submitCustomDomain = (text: string) => {
    const domain = stripSpaces(text).replace(/@/g, '');
    if (!domain) return;
    setDraft((current) => ({ ...current, domain }));
    openConfirm();
  };

  const confirmPressed = () => {
    const focus = CONFIRM_FOCUS[activeIndex];
    if (focus === 'local') {
      openLocalPart();
    } else if (focus === 'domain') {
      openDomainList();
    } else {
      void finish(`${draft.localPart}@${draft.domain}`);
    }
  };

  // "Enter email" on the declined screen: back to where the long press
  // happened, with whatever was typed so far.
  const returnFromDeclined = () => {
    const target = declinedFrom.current;
    if (target === 'local') {
      openLocalPart();
    } else if (target === 'custom') {
      openCustomDomain(draft.domain);
    } else if (target === 'domain') {
      openDomainList();
    } else {
      openConfirm();
    }
  };

  const listLength =
    step === 'domain'
      ? DOMAIN_OPTIONS.length
      : step === 'confirm'
        ? CONFIRM_FOCUS.length
        : step === 'declined'
          ? DECLINED_ACTIONS.length
          : 0;

  // The keyboard steps own the encoder; this drives the lists and the
  // confirm step, where the focus wraps around.
  useHandleGestures(
    {
      left() {
        if (listLength === 0) return;
        setActiveIndex((prev) =>
          step === 'confirm'
            ? (prev + listLength - 1) % listLength
            : Math.max(prev - 1, 0)
        );
      },
      right() {
        if (listLength === 0) return;
        setActiveIndex((prev) =>
          step === 'confirm'
            ? (prev + 1) % listLength
            : Math.min(prev + 1, listLength - 1)
        );
      },
      pressDown() {
        if (step === 'domain') {
          chooseDomainOption(activeIndex);
        } else if (step === 'confirm') {
          confirmPressed();
        } else if (step === 'declined') {
          if (DECLINED_ACTIONS[activeIndex].key === 'ok') {
            void finish(null);
          } else {
            returnFromDeclined();
          }
        }
      },
      longEncoder() {
        if (step === 'domain' || step === 'confirm') bail();
      }
    },
    bubbleDisplay.interceptsGesture
  );

  const longPressHint: Hint = {
    input: 'Long press',
    action: edit ? 'Cancel' : 'Skip'
  };

  if (step === 'local') {
    return (
      <CircleKeyboard
        name="email to reach you back"
        defaultValue={keyboardSeed}
        suffix="@"
        onChange={localPartTyped}
        onSubmit={submitLocalPart}
        onCancel={bail}
        onLongPress={bail}
        capitalizeFirstLetter={false}
      />
    );
  }

  if (step === 'custom') {
    return (
      <CircleKeyboard
        name={`domain for ${draft.localPart}`}
        defaultValue={keyboardSeed}
        prefix="@"
        onChange={(text) =>
          setDraft((current) => ({ ...current, domain: text }))
        }
        onSubmit={submitCustomDomain}
        onCancel={bail}
        onLongPress={bail}
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
          {DOMAIN_OPTIONS.slice(0, BACKSPACE_INDEX).map((domain, index) => (
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
        <div
          className={`report-contact-option report-contact-backspace ${
            activeIndex === BACKSPACE_INDEX ? 'active' : ''
          }`}
        >
          {BACKSPACE_LABEL}
        </div>
        <Hints hints={[{ input: 'Press', action: 'Select' }, longPressHint]} />
      </div>
    );
  }

  if (step === 'confirm') {
    const focus = CONFIRM_FOCUS[activeIndex];
    return (
      <div className="report-contact-screen">
        <span className="report-contact-eyebrow">
          {edit ? 'Your contact email' : 'Confirm your email'}
        </span>
        <span className="report-contact-address report-contact-confirm">
          <span
            className={`report-contact-part ${
              focus === 'local' ? 'active' : ''
            }`}
          >
            {draft.localPart}
          </span>
          <span className="report-contact-at">@</span>
          <span
            className={`report-contact-part ${
              focus === 'domain' ? 'active' : ''
            }`}
          >
            {draft.domain}
          </span>
        </span>
        <p className="report-contact-legend">
          Rotate the knob to select which part to edit, your email or its
          domain.
        </p>
        <div className="report-contact-actions">
          <div
            className={`report-contact-option ${
              focus === 'ok' ? 'active' : ''
            }`}
          >
            Ok
          </div>
        </div>
        <Hints
          hints={[
            { input: 'Press', action: focus === 'ok' ? 'Confirm' : 'Edit' },
            longPressHint
          ]}
        />
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
