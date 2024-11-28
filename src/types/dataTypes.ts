import {
  colorDataBlueLight,
  colorDataGreenLight,
  colorDataRed,
  colorDataYellow
} from '../constants/colors';

export type DataTypeKey = 'weight' | 'pressure' | 'flow';

export interface DataType {
  minValue: number;
  maxValue: number;
  axisLabelStep: number;
  name: string;
  unit: string;
  color: string;
  precision: 0 | 1;
}

export const dataTypes: Record<DataTypeKey | 'temperature', DataType> = {
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
    color: colorDataBlueLight,
    precision: 1
  },
  flow: {
    name: 'Flow',
    minValue: 0,
    maxValue: 12,
    axisLabelStep: 2,
    unit: 'ml/s',
    color: colorDataGreenLight,
    precision: 1
  }
};
