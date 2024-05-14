import { PressetSettings } from '../types/index';

interface PayloadProps {
  presset: PressetSettings;
}

export const getKeyPresset = (presset: PressetSettings, key: string) => {
  return presset.settings.find((item) => item.key === key);
};

export const generateSimplePayload = ({ presset }: PayloadProps) => {
  const temperature = getKeyPresset(presset, 'temperature');
  const startPressure = getKeyPresset(presset, 'pressure_1');
  const endPressure = getKeyPresset(presset, 'pressure_2');
  const output = getKeyPresset(presset, 'output');

  return {
    id: presset.id,
    name: presset.name,
    temperature: temperature.value,
    final_weight: output.value,
    variables: [
      {
        name: 'Start Pressure',
        key: 'pressure_1',
        type: 'pressure',
        value: startPressure.value
      },
      {
        name: 'End Pressure',
        key: 'pressure_2',
        type: 'pressure',
        value: endPressure.value
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
