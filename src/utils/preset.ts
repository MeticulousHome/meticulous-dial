import { IPresetAction, IPresetSetting, IPresetsSettingData } from '../types';
import { DEFAULT_SETTING } from '../constants/Setting';
import Swiper from 'swiper';

export const handleRemovePresetsAnimation = (swiper: Swiper) => {
  if (swiper && swiper.slides)
    swiper.slides.forEach((slide) => {
      slide
        ?.querySelector('div')
        .classList.remove('animation-bounce-left', 'animation-bounce-right');
    });
};

export const handleAddPresetAnimation = (swiper: Swiper) => {
  const { previousIndex, activeIndex, slides } = swiper;

  const animation = activeIndex > previousIndex ? 'left' : 'right';

  if (swiper.slides[activeIndex]) {
    swiper.slides[activeIndex]
      ?.querySelector('div')
      .classList.add(`animation-bounce-${animation}`);

    if (slides.length < 2) return;
    if (activeIndex === 0 || activeIndex === slides.length - 1) {
      slides[previousIndex]
        ?.querySelector('div')
        .classList.add(`animation-bounce-${animation}`);
    } else {
      slides[previousIndex]
        ?.querySelector('div')
        .classList.add(`animation-bounce-${animation}`);

      slides[activeIndex > previousIndex ? activeIndex + 1 : activeIndex - 1]
        ?.querySelector('div')
        .classList.add(`animation-bounce-${animation}`);
    }
  }
};

export const generateDefaultAction = (length: number) => {
  const actions = DEFAULT_SETTING.map((action) => ({
    ...action,
    id: length + 1
  }));

  return actions;
};

export const addSettingActions = (data: IPresetsSettingData[]) => {
  const newData = data.map((item) => ({
    ...item,
    settings: [
      ...item.settings,
      ...generateDefaultAction(item.settings.length).flat()
    ]
  }));

  return newData;
};
