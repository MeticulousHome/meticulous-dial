import { JSONValue, IPresetsSettingData } from '../../src/types';

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

export const formatStatValue = (value: string, padEnd: number) => {
  let fValue = 0.0;

  try {
    fValue = parseFloat(value);
  } catch (e) {
    return fValue;
  }

  const finalNumber = roundPrecision(fValue, 1).toString();
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
