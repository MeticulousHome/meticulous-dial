import { PressetSettings } from '../types/index';

interface PayloadProps {
  presset: PressetSettings;
}

const getKeyPresset = (presset: PressetSettings, key: string) => {
  return presset.settings.find((item) => item.key === key);
};

export const generateSimplePayload = ({ presset }: PayloadProps) => {
  const temperature = getKeyPresset(presset, 'temperature');
  const pressure = getKeyPresset(presset, 'pressure');
  const output = getKeyPresset(presset, 'output');
  // const preinfusion = getKeyPresset(presset, 'pre-infusion');
  // const preheat = getKeyPresset(presset, 'pre-heat');
  // const purge = getKeyPresset(presset, 'purge');

  return {
    id: presset.id,
    name: presset.name,
    temperature: temperature.value,
    final_weight: output.value,
    variables: [
      {
        name: 'Pressure',
        key: 'pressure_1',
        type: 'pressure',
        value: pressure
      }
    ],
    stages: [
      {
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
        //eslint-disable-next-line
        //@ts-ignore
        limits: []
      },
      {
        name: 'Infusion',
        type: 'pressure',
        dynamics: {
          points: [[0, '$pressure_1']],
          over: 'time',
          interpolation: 'linear'
        },
        //eslint-disable-next-line
        //@ts-ignore
        exit_triggers: [],
        //eslint-disable-next-line
        //@ts-ignore
        limits: []
      }
    ]
  };
};
