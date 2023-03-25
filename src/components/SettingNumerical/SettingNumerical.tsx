import { useCallback, useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';

import {
  IPresetNumericalTemperature,
  IPresetNumericalPressure,
  IPresetNumericalOutput,
  ISettingType
} from '../../types';
import { addRightComplement, roundPrecision } from '../../utils';
import { updatePresetSetting } from '../store/features/presetSetting/presetSetting-slice';
import { useReduxSelector } from '../store/store';
import './setting-numerical.css';

const radius = 237;
const strokeWidth = 6;
const circumference = radius * 2 * Math.PI;
const transform = `rotate(116.5, ${radius}, ${radius})`;

interface Props {
  type: ISettingType;
}

export function SettingNumerical({ type }: Props): JSX.Element {
  const gesture = useReduxSelector((state) => state.gesture);
  const screen = useReduxSelector((state) => state.screen);
  const presetSetting = useReduxSelector((state) => state.presetSetting);
  const [total, setTotal] = useState<number>(0);
  const [interval, setInterval] = useState<number>(0);
  const [maxValue, setMaxValue] = useState<number>(0);
  const [unit, setUnit] = useState<string>('0');
  const [customClass, setCustomClass] = useState<string>('');

  const settingTemperature = presetSetting.updatingSettings.settings.find(
    (setting) => setting.key === 'temperature'
  ) as IPresetNumericalTemperature;

  const settingPressure = presetSetting.updatingSettings.settings.find(
    (setting) => setting.key === 'pressure'
  ) as IPresetNumericalPressure;

  const settingOutput = presetSetting.updatingSettings.settings.find(
    (setting) => setting.key === 'output'
  ) as IPresetNumericalOutput;

  const dispatch = useDispatch();

  useEffect(() => {
    if (screen.value !== 'settingNumerical') {
      return;
    }
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
    if (screen.value !== 'settingNumerical') {
      return;
    }
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

  const getDashArray = (value: number) => {
    const mI = (307.2 / maxValue) * (value / 100);
    const fA = mI * 100;
    const marc = circumference * (fA / 360);

    return `${marc} ${circumference}`;
  };

  useEffect(() => {
    switch (type) {
      case 'pressure':
        setInterval(0.1);
        setTotal(Number(settingPressure?.value));
        setUnit('bar');
        setMaxValue(13);
        setCustomClass('scale-pressure');
        break;
      case 'temperature':
        setInterval(0.5);
        setTotal(Number(settingTemperature?.value));
        setUnit('°C');
        setMaxValue(99);
        setCustomClass('scale-temp');
        break;
      case 'output':
        setInterval(1);
        setTotal(Number(settingOutput?.value));
        setUnit('g');
        setMaxValue(100);
        setCustomClass('scale-weight-limit');
        break;
      default:
        break;
    }
  }, [type, presetSetting]);

  const getTotalString = () => {
    let toLayout = '';
    let withPads = '';
    switch (type) {
      case 'pressure':
      case 'temperature':
        toLayout = addRightComplement(roundPrecision(total, 1).toString());
        withPads = toLayout.padStart(4, '0');
        break;
      case 'output':
        toLayout = total.toString();
        withPads = toLayout.padStart(3, '0');
        break;
      default:
        break;
    }

    if (/^0*$/.test(toLayout.replace('.', ''))) {
      return <span className="opacity-20">{withPads}</span>;
    }

    const pads: JSX.Element[] = [];
    withPads.split(toLayout).map((i: string) => {
      for (let y = 1; y <= i.length; y++) {
        pads.push(
          <span key={y} className="opacity-20">
            0
          </span>
        );
      }
    });

    pads.push(<>{toLayout}</>);
    return pads;
  };

  const getAnimation = useCallback(() => {
    let animation = 'hidden';

    if (
      (screen.value === 'scale' && screen.prev === 'settingNumerical') ||
      (screen.value === 'settingNumerical' && screen.prev === 'scale')
    ) {
      animation = '';
    } else if (screen.value === 'settingNumerical') {
      animation = 'settingNumericalContent__fadeIn';
    } else if (screen.prev === 'settingNumerical') {
      animation = 'settingNumericalContent__fadeOut';
    }

    return animation;
  }, [screen]);

  return (
    <div className="gauge-container">
      <div className={`scalesLayout ${getAnimation()}`}>
        {/* <div className="title-main-1">sub-title</div> */}
        <div
          className="main-title-selected title__Big"
          style={{
            fontWeight: 'bold'
          }}
        >
          {type}
        </div>
        <div className={`scale-content ${customClass}`}>
          <div className="scale-level">{getTotalString()}</div>
          <div className="scale-unit">{unit}</div>
        </div>
      </div>
      <svg
        className={`${
          screen.value === 'settingNumerical'
            ? 'settingNumerical__fadeIn'
            : screen.prev === 'settingNumerical'
            ? 'settingNumerical__fadeOut'
            : 'hidden'
        }`}
        width="480"
        height="480"
        viewBox="0 0 480 480"
      >
        <circle
          fill="transparent"
          cx={radius}
          cy={radius - 3}
          r={radius}
          stroke="#272727"
          strokeWidth={strokeWidth}
          strokeDasharray={getDashArray(maxValue)}
          transform={transform}
        />
        <circle
          fill="transparent"
          cx={radius}
          cy={radius - 3}
          r={radius}
          stroke="white"
          strokeWidth={strokeWidth}
          strokeDasharray={getDashArray(total)}
          transform={transform}
        />
      </svg>
    </div>
  );
}
