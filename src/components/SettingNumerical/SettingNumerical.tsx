import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';

import {
  IPresetNumericalTemperature,
  IPresetNumericalPressure,
  IPresetNumericalOutput,
  ISettingType
} from '../../types';
import { roundPrecision } from '../../utils';
import { useReduxSelector } from '../store/store';
import { Gauge, Unit } from './Gauge';
import { updatePresetSetting } from '../store/features/preset/preset-slice';

interface ISettingConfig {
  interval: number;
  unit: Unit;
  maxValue: number;
}
type NumericalSettingType = 'pressure' | 'temperature' | 'output';
const unitSettingConfigMap: Record<NumericalSettingType, ISettingConfig> = {
  pressure: {
    interval: 0.1,
    unit: 'bar',
    maxValue: 13
  },
  temperature: {
    interval: 0.5,
    unit: 'celcius',
    maxValue: 99
  },
  output: {
    interval: 1,
    unit: 'gram',
    maxValue: 100
  }
};

interface Props {
  type: ISettingType;
}

export function SettingNumerical({ type }: Props): JSX.Element {
  const gesture = useReduxSelector((state) => state.gesture);
  const presets = useReduxSelector((state) => state.presets);
  const [total, setTotal] = useState<number>(0);
  const { interval, maxValue, unit } = unitSettingConfigMap[
    type as NumericalSettingType
  ] ?? {
    interval: 0,
    maxValue: 0,
    unit: 'gram'
  };

  const settingTemperature = presets.updatingSettings.settings.find(
    (setting) => setting.key === 'temperature'
  ) as IPresetNumericalTemperature;

  const settingPressure = presets.updatingSettings.settings.find(
    (setting) => setting.key === 'pressure'
  ) as IPresetNumericalPressure;

  const settingOutput = presets.updatingSettings.settings.find(
    (setting) => setting.key === 'output'
  ) as IPresetNumericalOutput;

  const dispatch = useDispatch();

  useEffect(() => {
    let mTotal;
    switch (gesture.value) {
      case 'click':
        break;
      case 'doubleTare':
        break;
      case 'left':
      case 'right':
        if (
          (total === maxValue && gesture.value === 'right') ||
          (total === 0 && gesture.value === 'left')
        ) {
          return;
        }
        mTotal = total + (gesture.value === 'left' ? -interval : +interval);
        setTotal(type === 'output' ? mTotal : roundPrecision(mTotal, 1));
        break;
      default:
        break;
    }
  }, [gesture]);

  useEffect(() => {
    switch (type) {
      case 'temperature':
        dispatch(
          updatePresetSetting({
            ...settingTemperature,
            value: total
          } as unknown as IPresetNumericalTemperature)
        );
        break;
      case 'pressure':
        dispatch(
          updatePresetSetting({
            ...settingPressure,
            value: total
          } as unknown as IPresetNumericalTemperature)
        );
        break;
      case 'output':
        dispatch(
          updatePresetSetting({
            ...settingOutput,
            value: total
          } as unknown as IPresetNumericalTemperature)
        );
        break;
      default:
        break;
    }
  }, [type, total]);

  useEffect(() => {
    switch (type) {
      case 'pressure':
        setTotal(Number(settingPressure?.value));
        break;
      case 'temperature':
        setTotal(Number(settingTemperature?.value));
        break;
      case 'output':
        setTotal(Number(settingOutput?.value));
        break;
      default:
        break;
    }
  }, [type, presets]);

  return (
    <Gauge
      title={type}
      unit={unit}
      maxValue={maxValue}
      precision={interval < 1 ? 1 : 0}
      value={total}
    />
  );
}
