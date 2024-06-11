import { v4 as uuidv4 } from 'uuid';
import { Profile } from 'meticulous-typescript-profile';

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
      key: uuidv4(),
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
      key: uuidv4(),
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
