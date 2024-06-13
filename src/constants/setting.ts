import { ActionKey } from '../../src/types';

export type StaticAction = {
  type: 'action';
  key: ActionKey;
  label: string;
};

export const DEFAULT_SETTING: StaticAction[] = [
  {
    type: 'action',
    key: 'save',
    label: 'save'
  },
  {
    type: 'action',
    key: 'discard',
    label: 'discard'
  },
  {
    type: 'action',
    key: 'delete',
    label: 'delete profile'
  }
];

export const TEMPORARY_SETTINGS: StaticAction[] = [
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
