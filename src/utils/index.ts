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
  value: string,
  padEnd: number,
  fixpointFactor = 1.0
) => {
  let fValue = 0.0;

  try {
    fValue = parseFloat(value);
  } catch (e) {
    return fValue;
  }

  const finalNumber = roundPrecision(fValue / fixpointFactor, 1).toString();
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

export const clickAndHold = (btnEl: any) => {
  let timerId: NodeJS.Timer;
  const DURATION = 50;

  //handle when clicking down
  const onMouseDown = () => {
    timerId = setInterval(() => {
      btnEl && btnEl.click();
    }, DURATION);
  };

  //stop or clear interval
  const clearTimer = () => {
    timerId && clearInterval(timerId);
  };

  //handle when mouse is clicked
  btnEl.addEventListener('mousedown', onMouseDown);
  //handle when mouse is raised
  btnEl.addEventListener('mouseup', clearTimer);
  //handle mouse leaving the clicked button
  btnEl.addEventListener('mouseout', clearTimer);

  // a callback function to remove listeners useful in libs like react
  // when component or element is unmounted
  return () => {
    btnEl.removeEventListener('mousedown', onMouseDown);
    btnEl.removeEventListener('mouseup', clearTimer);
    btnEl.removeEventListener('mouseout', clearTimer);
  };
};
