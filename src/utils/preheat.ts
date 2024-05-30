import { Profile } from 'meticulous-typescript-profile';

import { Actions, PressetSettings } from '../types/index';

interface PayloadProps {
  presset: PressetSettings;
  action: Actions;
}

const getKeyPresset = (presset: PressetSettings, key: string) => {
  return presset.settings.find((item) => item.key === key);
};

export const simpleJson: Profile = {
  id: '',
  name: 'New Preset',
  author: '',
  author_id: '',
  previous_authors: [{ name: '', author_id: '', profile_id: '' }],
  temperature: 88,
  final_weight: 36,
  display: {
    image: ''
  },
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
      key: 'pre_infusion',
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
      key: 'infusion',
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
