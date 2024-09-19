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
import { useHandleGestures } from '../../hooks/useHandleGestures';
import { setScreen } from '../store/features/screens/screens-slice';
import { useAppSelector } from '../store/hooks';

interface ISettingConfig {
  interval: number;
  unit: Unit;
  maxValue: number;
}
type NumericalSettingType =
  | 'pressure'
  | 'temperature'
  | 'output'
  | 'flow'
  | 'time'
  | 'weight';
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
  },
  flow: {
    interval: 0.1,
    unit: 'ml',
    maxValue: 12
  },
  time: {
    interval: 0.1,
    unit: 'sec',
    maxValue: 180
  },
  weight: {
    interval: 0.1,
    unit: 'gram',
    maxValue: 2000
  }
};

interface Props {
  type: ISettingType;
}

export function SettingNumerical({ type }: Props): JSX.Element {
  const setting = useReduxSelector(
    (state) =>
      state.presets.updatingSettings.settings[state.presets.activeSetting]
  );

  const bubbleDisplay = useAppSelector((state) => state.screen.bubbleDisplay);
  const total = Number(setting?.value || 0);
  const { interval, maxValue, unit } = unitSettingConfigMap[
    type as NumericalSettingType
  ] ?? {
    interval: 0,
    maxValue: 0,
    unit: 'gram'
  };

  const dispatch = useDispatch();

  const updateValue = (gesture: 'left' | 'right') => {
    if (
      (total === maxValue && gesture === 'right') ||
      (total === 0 && gesture === 'left')
    ) {
      return;
    }
    const mTotal = total + (gesture === 'left' ? -interval : +interval);
    const value = type === 'output' ? mTotal : roundPrecision(mTotal, 1);
    dispatch(
      updatePresetSetting({
        ...setting,
        value
      } as unknown as
        | IPresetNumericalTemperature
        | IPresetNumericalPressure
        | IPresetNumericalOutput)
    );
  };

  useHandleGestures(
    {
      left() {
        updateValue('left');
      },
      right() {
        updateValue('right');
      },
      pressDown() {
        dispatch(setScreen('pressetSettings'));
      }
    },
    bubbleDisplay.visible
  );

  return (
    <Gauge
      unit={unit}
      maxValue={maxValue}
      precision={interval < 1 ? 1 : 0}
      value={total}
    />
  );
}
