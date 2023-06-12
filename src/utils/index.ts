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

export const mergeJson = (currentJson: JSONValue, defaultJson: JSONValue) => {
  const mSettings = currentJson as unknown as IPresetsSettingData[];
  const dSettings = defaultJson as unknown as IPresetsSettingData[];

  for (const y in dSettings[0].settings) {
    const dKey = dSettings[0].settings[y].key;
    for (const x in mSettings) {
      let isOnObject = false;
      for (const z in mSettings[x].settings) {
        if (mSettings[x].settings[z].key === dKey) {
          isOnObject = true;
          continue;
        }
      }

      if (!isOnObject) {
        mSettings[x].settings.push(dSettings[0].settings[y]);
        mSettings[x].settings.sort((a, b) => a.id - b.id);
      }
    }
  }

  return mSettings;
};
