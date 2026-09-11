import type { ActionKey } from '../../src/types';

export type StaticAction = {
  type: 'action';
  key: ActionKey;
  label: string;
};

export const DEFAULT_SETTING: StaticAction[] = [
  {
    type: 'action',
    key: 'brew_once',
    label: 'brew without saving'
  },
  {
    type: 'action',
    key: 'save',
    label: 'save'
  },
  {
    type: 'action',
    key: 'discard',
    label: 'discard'
  }
];

export const TEMPORARY_SETTINGS: StaticAction[] = [
  {
    type: 'action',
    key: 'brew_once',
    label: 'brew without saving'
  },
  {
    type: 'action',
    key: 'save',
    label: 'save permanently'
  },
  {
    type: 'action',
    key: 'discard',
    label: 'discard'
  }
];

// When the stage changes, if it is one of the followings
// do not show the barometer
export const HIDDEN_STAGES: string[] = [
  'idle',
  'boot',
  'END_STAGE',
  'starting...'
];

// Status names the firmware owns. A status outside this list while
// `extracting` is a user-defined stage of the loaded profile.
export const MACHINE_OWNED_STAGES: string[] = [
  'heating',
  'click to start',
  'retracting',
  'closing valve',
  'purge',
  'remove cup',
  'click to purge',
  'Pour water and click to continue',
  'starting...',
  'home',
  'boot',
  'idle',
  'END_STAGE',
  'finished'
];
