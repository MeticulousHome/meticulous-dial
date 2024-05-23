// eslint-disable-next-line import/no-named-as-default
import Swiper from 'swiper';

import { IPresetSetting } from '../types';
import { DEFAULT_SETTING } from '../constants/setting';
import { PresetsState } from '../components/store/features/preset/preset-slice';

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

export const handleAddLeaveAnimation = (swiper: Swiper) => {
  if (!swiper.slides) return;
  //
  const { activeIndex, slides } = swiper;

  if (slides[activeIndex - 1]) {
    slides[activeIndex - 1]
      .querySelector('div')
      .classList.add('animation-pressets-left-leave');
  }
  if (slides[activeIndex + 1]) {
    slides[activeIndex + 1]
      .querySelector('div')
      .classList.add('animation-pressets-right-leave');
  }
};

export const handleRemoveLeaveAnimation = (swiper: Swiper) => {
  if (!swiper.slides) return;

  const { activeIndex, slides } = swiper;

  if (slides[activeIndex - 1]) {
    slides[activeIndex - 1]
      .querySelector('div')
      .classList.remove('animation-pressets-left-leave');
  }
  if (slides[activeIndex + 1]) {
    slides[activeIndex + 1]
      .querySelector('div')
      .classList.remove('animation-pressets-right-leave');
  }
};

export const handleRemoveEnterAnimation = (swiper: Swiper) => {
  if (!swiper.slides) return;

  const { activeIndex, slides } = swiper;

  if (slides[activeIndex - 1]) {
    slides[activeIndex - 1]
      .querySelector('div')
      .classList.remove('animation-pressets-left-enter');
  }
  if (slides[activeIndex + 1]) {
    slides[activeIndex + 1]
      .querySelector('div')
      .classList.remove('animation-pressets-right-enter');
  }
};

export const handleAddEnterAnimation = (swiper: Swiper) => {
  if (!swiper.slides) return;

  const { activeIndex, slides } = swiper;

  if (slides[activeIndex - 1]) {
    slides[activeIndex - 1]
      .querySelector('div')
      .classList.add('animation-pressets-left-enter');
  }
  if (slides[activeIndex + 1]) {
    slides[activeIndex + 1]
      .querySelector('div')
      .classList.add('animation-pressets-right-enter');
  }
};

export const handleAddIncreseAnimation = (swiper: Swiper) => {
  if (!swiper.slides) return;

  const { activeIndex, slides } = swiper;

  if (slides[activeIndex]) {
    slides[activeIndex]
      .querySelector('div')
      .classList.add('animation-presset-selected-increse');
  }
};

export const handleRemoveIncreseAnimation = (
  swiper: Swiper & { initialized?: boolean }
) => {
  if (!swiper.initialized) return;

  if (!swiper.slides) return;

  const { activeIndex, slides } = swiper;

  if (slides[activeIndex]) {
    slides[activeIndex]
      .querySelector('div')
      .classList.remove('animation-presset-selected-increse');
  }
};

export const handleRemoveDecreseAnimation = (
  swiper: Swiper & { initialized?: boolean }
) => {
  if (!swiper.initialized) return;

  if (!swiper.slides) return;

  const { activeIndex, slides } = swiper;

  if (slides[activeIndex]) {
    slides[activeIndex]
      .querySelector('div')
      .classList.remove('animation-presset-selected-decrese');
  }
};

export const handleAddDecreseAnimation = (
  swiper: Swiper & { initialized?: boolean }
) => {
  if (!swiper.initialized) return;

  if (!swiper.slides) return;

  const { activeIndex, slides } = swiper;

  if (slides[activeIndex]) {
    slides[activeIndex]
      .querySelector('div')
      .classList.add('animation-presset-selected-decrese');
  }
};

export const clearSlides = (swiper: Swiper & { initialized?: boolean }) => {
  if (!swiper.initialized) return;

  if (!swiper.slides) return;

  for (const slide of swiper.slides) {
    slide
      .querySelector('div')
      .classList.remove(
        'animation-pressets-right-leave',
        'animation-pressets-right-enter',
        'animation-pressets-left-enter',
        'animation-pressets-left-leave',
        'animation-presset-selected-increse',
        'animation-presset-selected-decrese'
      );
  }
};

export const handleAddOpacityTitleActive = (
  swiper: Swiper & { initialized?: boolean }
) => {
  if (!swiper.initialized) return;

  if (!swiper.slides) return;

  const { activeIndex, slides } = swiper;

  if (slides[activeIndex]) {
    slides[activeIndex].classList.add('animation-title-opacity-one');
  }
};

export const handleRemoveOpacityTitleActive = (
  swiper: Swiper & { initialized?: boolean }
) => {
  if (!swiper.initialized) return;

  if (!swiper.slides) return;

  const { activeIndex, slides } = swiper;

  if (slides[activeIndex]) {
    slides[activeIndex].classList.remove('animation-title-opacity-one');
  }
};

export const handleAddOpacityTitleInactive = (
  swiper: Swiper & { initialized?: boolean }
) => {
  if (!swiper.initialized) return;

  if (!swiper.slides) return;

  const { activeIndex, slides } = swiper;

  if (slides[activeIndex]) {
    slides[activeIndex].classList.add('animation-title-opacity-zero');
  }
};

export const handleRemoveOpacityTitleInactive = (
  swiper: Swiper & { initialized?: boolean }
) => {
  if (!swiper.initialized) return;

  if (!swiper.slides) return;

  const { activeIndex, slides } = swiper;

  if (slides[activeIndex]) {
    slides[activeIndex].classList.remove('animation-title-opacity-zero');
  }
};

export const handleSlidesLeave = (
  swiper: Swiper & { initialized?: boolean }
) => {
  if (swiper.initialized) {
    handleAddLeaveAnimation(swiper);
  }
};

export const handleSlidesEnter = (
  swiper: Swiper & { initialized?: boolean }
) => {
  if (swiper.initialized) {
    handleAddEnterAnimation(swiper);
  }
};

export const handlePresetSlideChange = (
  swiper: Swiper & { initialized?: boolean }
) => {
  if (swiper.initialized) {
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

export const getPresetSettings = (presets: PresetsState): IPresetSetting[] => {
  if (presets.updatingSettings.settings) {
    const presetsLength = presets.updatingSettings.settings.length;

    const defaultSettings = generateDefaultAction(
      presetsLength
    ).flat() as IPresetSetting[];

    return [
      ...presets.updatingSettings.settings.filter(
        (setting) => setting.key === 'name'
      ),
      ...defaultSettings
    ];
  }
};
