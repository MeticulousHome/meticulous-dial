import {
  colorDataBlueLight,
  colorDataGreenLight,
  colorDataRed,
  colorDataYellow,
  colorDataWhite,
  colorDataYellowBright
} from '../constants/colors';

export type DataTypeKey = 'weight' | 'pressure' | 'flow';
export type ExtraSettingType =
  'piston_position' | 'motor_power' | 'temperature';

export interface DataType {
  minValue: number;
  maxValue: number;
  axisLabelStep: number;
  name: string;
  unit: string;
  color: string;
  precision: 0 | 1;
}

export const dataTypes: Record<DataTypeKey | ExtraSettingType, DataType> = {
  piston_position: {
    name: 'piston position',
    minValue: 0,
    maxValue: 100,
    axisLabelStep: 25,
    unit: '%',
    color: colorDataWhite,
    precision: 1
  },
  motor_power: {
    name: 'motor power',
    minValue: 0,
    maxValue: 100,
    axisLabelStep: 25,
    unit: '%',
    color: colorDataYellowBright,
    precision: 1
  },
  weight: {
    name: 'Weight',
    minValue: 0,
    maxValue: 100,
    axisLabelStep: 25,
    unit: 'g',
    color: colorDataYellow,
    precision: 1
  },
  temperature: {
    name: 'Temp',
    minValue: 0,
    maxValue: 100,
    axisLabelStep: 25,
    unit: '°C',
    color: colorDataRed,
    precision: 0
  },
  pressure: {
    name: 'Pressure',
    minValue: 0,
    maxValue: 12,
    axisLabelStep: 2,
    unit: 'bar',
    color: colorDataGreenLight,
    precision: 1
  },
  flow: {
    name: 'Flow',
    minValue: 0,
    maxValue: 12,
    axisLabelStep: 2,
    unit: 'ml/s',
    color: colorDataBlueLight,
    precision: 1
  }
};
