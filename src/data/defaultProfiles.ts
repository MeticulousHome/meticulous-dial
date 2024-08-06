import { Profile } from 'meticulous-typescript-profile';

export const profiles: Array<Profile> = [
  {
    id: '1',
    name: 'Pp',
    author: '',
    author_id: '00000000-0000-0000-0000-000000000000',
    previous_authors: [{ name: '', author_id: '', profile_id: '' }],
    temperature: 94,
    final_weight: 36,
    display: { image: 'f9e16abcc19c1a34deaa9c2ac3bc7653.png' },
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
        key: '91a29083-4f63-4088-929d-2e1d66f85e3b',
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
            value: 8,
            relative: false,
            comparison: '>='
          }
        ],
        limits: []
      },
      {
        key: 'f8d91667-0737-4220-afc9-585b5b5d61a5',
        name: 'Infusion',
        type: 'pressure',
        dynamics: {
          points: [[0, 8]],
          over: 'time',
          interpolation: 'linear'
        },
        exit_triggers: [],
        limits: []
      }
    ]
  },
  {
    id: '2',
    name: 'New Preset',
    author: '',
    author_id: '00000000-0000-0000-0000-000000000000',
    previous_authors: [{ name: '', author_id: '', profile_id: '' }],
    temperature: 88,
    final_weight: 36,
    display: { image: 'ead0615ce86b2596e9c310494c4cd542.png' },
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
        key: '91a29083-4f63-4088-929d-2e1d66f85e3b',
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
            value: 8,
            relative: false,
            comparison: '>='
          }
        ],
        limits: []
      },
      {
        key: 'f8d91667-0737-4220-afc9-585b5b5d61a5',
        name: 'Infusion',
        type: 'pressure',
        dynamics: {
          points: [[0, 8]],
          over: 'time',
          interpolation: 'linear'
        },
        exit_triggers: [],
        limits: []
      }
    ]
  },
  {
    id: '3',
    name: '1',
    author: '',
    author_id: '00000000-0000-0000-0000-000000000000',
    previous_authors: [{ name: '', author_id: '', profile_id: '' }],
    temperature: 88,
    final_weight: 36,
    display: { image: 'de720f6570d8215252eaf583fb9f3fc2.png' },
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
        key: 'af596015-94ed-4d53-98d8-9a88823c09d5',
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
            value: 8,
            relative: false,
            comparison: '>='
          }
        ],
        limits: []
      },
      {
        key: '18e52aee-c5ea-40b4-a7ef-eff6e0186919',
        name: 'Infusion',
        type: 'pressure',
        dynamics: {
          points: [[0, 8]],
          over: 'time',
          interpolation: 'linear'
        },
        exit_triggers: [],
        limits: []
      }
    ]
  },
  {
    id: '4',
    name: 'New Preset',
    author: '',
    author_id: '',
    previous_authors: [{ name: '', author_id: '', profile_id: '' }],
    temperature: 88,
    final_weight: 36,
    display: {
      image: '/api/v1/profile/image/0acc9eec8455a96de1c83250eca6d7f3.png'
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
        key: 'd392a2c0-581b-489f-bf40-528b18423e2f',
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
            value: 8,
            relative: false,
            comparison: '>='
          }
        ],
        limits: []
      },
      {
        key: 'd6a93879-851a-445a-8064-c50bd76b0edc',
        name: 'Infusion',
        type: 'pressure',
        dynamics: {
          points: [[0, 8]],
          over: 'time',
          interpolation: 'linear'
        },
        exit_triggers: [],
        limits: []
      }
    ]
  }
];
