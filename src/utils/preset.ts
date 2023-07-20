// eslint-disable-next-line import/no-named-as-default
import Swiper from 'swiper';
import { IPresetSetting } from '../types';
import { DEFAULT_SETTING } from '../constants/setting';

export const handleRemovePresetsAnimation = (swiper: Swiper) => {
  if (swiper && swiper.slides)
    swiper.slides.forEach((slide) => {
      slide
        ?.querySelector('div')
        .classList.remove('animation-bounce-left', 'animation-bounce-right');
    });
};

export const handleAddPresetAnimation = (swiper: Swiper) => {
  if (!swiper?.slides) return;

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

export const handlePresetSlideChange = (swiper: Swiper) => {
  if (swiper.previousIndex !== undefined) {
    handleRemovePresetsAnimation(swiper);
    setTimeout(() => {
      handleAddPresetAnimation(swiper);
    }, 20);
  }
};

export const generateDefaultAction = (length: number) => {
  const actions = DEFAULT_SETTING.map((action) => ({
    ...action,
    id: length + 1
  }));
  return actions;
};

export const filterSettingAction = (data: IPresetSetting[] = []) => {
  const listActions = DEFAULT_SETTING.map((action) => action.key);
  const newData = data.filter((setting) => {
    return !listActions.includes(setting.key);
  });

  return newData;
};
