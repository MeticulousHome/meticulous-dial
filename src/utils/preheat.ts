import { v4 as uuidv4 } from 'uuid';
import { Profile } from 'meticulous-typescript-profile';

import { Actions, PressetSettings } from '../types/index';
import { UUID } from 'meticulous-typescript-profile/dist/uuid';
import { KIND_PROFILE } from '../constants';

interface PayloadProps {
  presset: PressetSettings;
  action: Actions;
}

const getKeyPresset = (presset: PressetSettings, key: string) => {
  return presset.settings.find((item) => item.key === key);
};

// eslint-disable-next-line
// @ts-ignore
const _UUID = new UUID(uuidv4().toString()).value;
// eslint-disable-next-line
// @ts-ignore
const _AUTHOR_ID = new UUID(uuidv4().toString()).value;

export const simpleJson: Profile = {
  id: _UUID,
  name: 'New Preset',
  author: '',
  author_id: _AUTHOR_ID,
  previous_authors: [{ name: '', author_id: _AUTHOR_ID, profile_id: _UUID }],
  temperature: 88,
  final_weight: 36,
  variables: [
    {
      name: 'Pressure',
      key: 'pressure_1',
      type: 'pressure',
      value: 8
    }
  ],
  stages: [
    {
      key: '',
      name: 'Preinfusion',
      type: 'flow',
      dynamics: {
        points: [[0, 4]],
        over: 'time',
        interpolation: 'linear'
      },
      exit_triggers: [
        {
          type: 'time',
          value: 30,
          relative: true,
          comparison: '>='
        },
        {
          type: 'weight',
          value: 0.3,
          relative: true,
          comparison: '>='
        },
        {
          type: 'pressure',
          value: '$pressure_1',
          relative: false,
          comparison: '>='
        }
      ],
      limits: []
    },
    {
      key: '',
      name: 'Infusion',
      type: 'pressure',
      dynamics: {
        points: [[0, '$pressure_1']],
        over: 'time',
        interpolation: 'linear'
      },
      exit_triggers: [],
      limits: []
    }
  ]
};

export const generateSimplePayload = ({ presset }: PayloadProps) => {
  const name = presset.name;
  const temperature = getKeyPresset(presset, 'temperature');
  const pressure = getKeyPresset(presset, 'pressure');
  const output = getKeyPresset(presset, 'output');

  return {
    ...simpleJson,
    name,
    kind: KIND_PROFILE.ITALIAN,
    temperature: Number(temperature.value),
    final_weight: Number(output.value),
    variables: [
      {
        name: 'Pressure',
        key: 'pressure_1',
        type: 'pressure',
        value: Number(pressure.value)
      }
    ]
  };
};
