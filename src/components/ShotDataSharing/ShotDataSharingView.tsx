import './ShotDataSharing.css';

/** How long the thanks / stopped confirmation stays before leaving. */
export const THANKS_SCREEN_DURATION_MS = 4000;

export type ShotDataSharingActionKey =
  'help_improve' | 'no_thanks' | 'stop_sharing' | 'back';

export type ShotDataSharingAction = {
  key: ShotDataSharingActionKey;
  label: string;
};

export const OPT_IN_ACTIONS: ShotDataSharingAction[] = [
  { key: 'help_improve', label: 'Help improve' },
  { key: 'no_thanks', label: 'No thanks' }
];

export const OPT_OUT_ACTIONS: ShotDataSharingAction[] = [
  { key: 'stop_sharing', label: 'Stop sharing' },
  { key: 'back', label: 'Back' }
];

export const SHOT_DATA_SHARING_TITLE = 'Help us improve';

export const SHOT_DATA_SHARING_OPT_IN_COPY =
  'Share sensor data from your brews anonymously with Meticulous to help ' +
  'us improve brew quality and reliability. It never includes your name, ' +
  'serial number or network details.';

export const SHOT_DATA_SHARING_SHARING_COPY =
  'Anonymous sensor data from your brews is being shared with Meticulous. ' +
  'You can stop sharing at any time.';

export const SHOT_DATA_SHARING_LATER_NOTE =
  'You can change this any time from the menu under Help us improve.';

export const SHOT_DATA_SHARING_ERROR =
  'Could not save your choice. Please try again.';

type ShotDataSharingViewProps = {
  title: string;
  copy: string;
  footnote?: string;
  actions: ShotDataSharingAction[];
  activeIndex: number;
  busy?: boolean;
  error?: boolean;
};

export const ShotDataSharingView = ({
  title,
  copy,
  footnote,
  actions,
  activeIndex,
  busy = false,
  error = false
}: ShotDataSharingViewProps) => (
  <div className="shot-data-sharing-screen">
    <h2>{title}</h2>
    <p className="shot-data-sharing-copy">{copy}</p>
    {footnote ? <p className="shot-data-sharing-footnote">{footnote}</p> : null}
    <div className="shot-data-sharing-actions">
      {actions.map((action, index) => (
        <div
          className={`shot-data-sharing-action ${activeIndex === index ? 'active' : ''}`}
          key={action.key}
        >
          {busy && activeIndex === index ? 'Saving...' : action.label}
        </div>
      ))}
    </div>
    {error ? (
      <p className="shot-data-sharing-error">{SHOT_DATA_SHARING_ERROR}</p>
    ) : null}
  </div>
);

export const ShotDataSharingThanks = () => (
  <div className="shot-data-sharing-screen">
    <h2>Thanks!</h2>
    <p className="shot-data-sharing-copy">
      Your brews will now help make every Meticulous better.
    </p>
  </div>
);

export const ShotDataSharingStopped = () => (
  <div className="shot-data-sharing-screen">
    <h2>Sharing stopped</h2>
    <p className="shot-data-sharing-copy">
      Your machine will no longer send brew data to Meticulous.
    </p>
  </div>
);
