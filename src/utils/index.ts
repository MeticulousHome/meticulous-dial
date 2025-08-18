import { memo } from 'react';
import { routes } from '../../src/navigation/routes';
import { IPresetsSettingData } from '../../src/types';

const regex = /^-?[0-9]+$/;

export const roundPrecision = (value: number, precision: number) => {
  const multiplier = Math.pow(10, precision || 0);
  return Math.round(value * multiplier) / multiplier;
};

export const addRightComplement = (value: string) => {
  if (!value.includes('.')) {
    value = value.concat('.0');
  }
  return value;
};

export const formatStatValue = (
  value: number,
  padEnd: number,
  fixpointFactor = 1.0
) => {
  const finalNumber = roundPrecision(value / fixpointFactor, 1).toString();
  if (regex.test(finalNumber)) {
    return finalNumber + '.' + '0'.repeat(padEnd);
  }
  return finalNumber;
};

export const isValidJson = (json: string) => {
  try {
    JSON.parse(json);
    return true;
  } catch (e) {
    console.log('ERROR:>> ', e);
    return false;
  }
};

export const mergeSettings = (currentJson: string, defaultJson: string) => {
  const mSettings = JSON.parse(currentJson) as IPresetsSettingData[];
  const dSettings = JSON.parse(defaultJson) as IPresetsSettingData[];

  const defaultSettings = dSettings.length > 0 ? dSettings[0].settings : [];

  defaultSettings.forEach((dSetting) => {
    const isOnObject = mSettings.some((mSetting) =>
      mSetting.settings.some((mSetting) => mSetting.key === dSetting.key)
    );

    if (!isOnObject) {
      mSettings.forEach((mSetting) => {
        mSetting.settings.push(dSetting);
        // We need to reassign the ID for each configuration
        mSetting.settings.forEach((el) => {
          el.id = defaultSettings.filter((e) => e.key === el.key)[0].id;
        });

        mSetting.settings.sort((a, b) => a.id - b.id);
      });
    }
  });

  return JSON.stringify(mSettings);
};

export const memoizedRoutes = Object.fromEntries(
  Object.entries(routes).map(([key, { component, ...route }]) => [
    key,
    { ...route, component: memo(component) }
  ])
);

export const formatTime = (seconds: number): string => {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${String(minutes).padStart(1, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
};
