import { useDispatch } from 'react-redux';

import {
  IPresetNumericalTemperature,
  IPresetNumericalPressure,
  IPresetNumericalOutput,
  ISettingType
} from '../../types';
import { roundPrecision } from '../../utils';
import { Gauge, Unit } from './Gauge';
import { useHandleGestures } from '../../hooks/useHandleGestures';
import { setScreen } from '../store/features/screens/screens-slice';
import { useAppSelector } from '../store/hooks';
import { useDimScreen } from '../../hooks/useDimScreen';
import { useProfileContext } from '../../context/ProfileContext';

interface ISettingConfig {
  interval: number;
  unit: Unit;
  minValue?: number;
  maxValue: number;
}
type NumericalSettingType =
  | 'pressure'
  | 'temperature'
  | 'output'
  | 'flow'
  | 'time'
  | 'piston_position'
  | 'motor_power'
  | 'weight';
const unitSettingConfigMap: Record<NumericalSettingType, ISettingConfig> = {
  pressure: {
    interval: 0.1,
    unit: 'bar',
    maxValue: 13
  },
  piston_position: {
    interval: 1,
    unit: 'percentage',
    maxValue: 100
  },
  motor_power: {
    interval: 1,
    unit: 'percentage',
    minValue: -99,
    maxValue: 100
  },
  temperature: {
    interval: 0.5,
    unit: 'celcius',
    maxValue: 99
  },
  output: {
    interval: 0.5,
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
  const { settingsIndex, settingsProfile, setSettingsProfile } =
    useProfileContext();
  const setting = settingsProfile.settings[settingsIndex];

  const bubbleDisplay = useAppSelector((state) => state.screen.bubbleDisplay);
  const total = Number(setting?.value || 0);
  const { interval, maxValue, unit, minValue } = unitSettingConfigMap[
    type as NumericalSettingType
  ] ?? {
    interval: 0,
    maxValue: 0,
    unit: 'gram'
  };

  const dispatch = useDispatch();

  useDimScreen();

  const updateValue = (gesture: 'left' | 'right') => {
    if (
      (total === maxValue && gesture === 'right') ||
      (total === (minValue || 0) && gesture === 'left')
    ) {
      return;
    }
    const mTotal = total + (gesture === 'left' ? -interval : +interval);
    const value = type === 'output' ? mTotal : roundPrecision(mTotal, 1);
    const updatedSetting = {
      ...setting,
      value
    } as unknown as
      | IPresetNumericalTemperature
      | IPresetNumericalPressure
      | IPresetNumericalOutput;
    setSettingsProfile((prev) => ({
      ...prev,
      settings: [
        ...prev.settings.slice(0, settingsIndex),
        updatedSetting,
        ...prev.settings.slice(settingsIndex + 1)
      ]
    }));
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
      minValue={minValue}
      maxValue={maxValue}
      precision={interval < 1 ? 1 : 0}
      value={total}
    />
  );
}
