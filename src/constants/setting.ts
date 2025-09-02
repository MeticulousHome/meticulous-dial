import { ActionKey } from '../../src/types';

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
