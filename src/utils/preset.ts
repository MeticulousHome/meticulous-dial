// eslint-disable-next-line import/no-named-as-default
import Swiper from 'swiper';

import {
  ActionKey,
  IPresetAction,
  IPresetBaseNumerical,
  IPresetSetting
} from '../types';
import {
  DEFAULT_SETTING,
  StaticAction,
  TEMPORARY_SETTINGS
} from '../constants/setting';
import { PresetsState } from '../components/store/features/preset/preset-slice';
import { Variable } from '@meticulous-home/espresso-profile';

export const handleRemovePresetsAnimation = (
  swiper: Swiper,
  orientation: 'horizontal' | 'vertical' = 'horizontal'
) => {
  if (swiper && swiper.slides)
    swiper.slides.forEach((slide) => {
      slide
        ?.querySelector('div')
        .classList.remove(
          `animation-bounce-${
            orientation === 'horizontal' ? 'left' : 'bottom'
          }`,
          `animation-bounce-${orientation === 'horizontal' ? 'right' : 'top'}`
        );
    });
};

export const handleAddPresetAnimation = (
  swiper: Swiper,
  orientation: 'horizontal' | 'vertical' = 'horizontal'
) => {
  if (!swiper?.slides) return;

  const { previousIndex, activeIndex, slides } = swiper;

  const animation =
    activeIndex > previousIndex
      ? orientation === 'horizontal'
        ? 'left'
        : 'bottom'
      : orientation === 'horizontal'
        ? 'right'
        : 'top';

  if (swiper.slides[activeIndex]) {
    swiper.slides[activeIndex]
      ?.querySelector('div')
      .classList.add(`animation-bounce-${animation}`);

    if (slides.length < 2) return;

    if (orientation === 'vertical') {
      // we are currently showing 4 items when is vertical so we are animation 4 elements
      if (slides[activeIndex + 1]) {
        slides[activeIndex + 1]
          ?.querySelector('div')
          .classList.add(`animation-bounce-${animation}`);
      }
      if (slides[activeIndex + 2]) {
        slides[activeIndex + 2]
          ?.querySelector('div')
          .classList.add(`animation-bounce-${animation}`);
      }
      if (slides[activeIndex - 1]) {
        slides[activeIndex - 1]
          ?.querySelector('div')
          .classList.add(`animation-bounce-${animation}`);
      }
      if (slides[activeIndex - 2]) {
        slides[activeIndex - 2]
          ?.querySelector('div')
          .classList.add(`animation-bounce-${animation}`);
      }
    } else {
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
  swiper: Swiper & { initialized?: boolean },
  orientation: 'horizontal' | 'vertical' = 'horizontal'
) => {
  if (swiper.initialized) {
    handleRemovePresetsAnimation(swiper, orientation);
    setTimeout(() => {
      handleAddPresetAnimation(swiper, orientation);
    }, 20);
  }
};

export const generateStaticActions = (
  settings: StaticAction[],
  length: number
) => {
  const actions: IPresetAction[] = settings.map((action) => ({
    ...action,
    id: length + 1,
    isInternal: true
  }));
  return actions;
};

export const filterSettingAction = (
  settings: StaticAction[],
  data: IPresetSetting[] = []
) => {
  const listActions = settings.map((action) => action.key);
  const newData = data.filter((setting) => {
    return !listActions.includes(setting.key as ActionKey);
  });

  return newData;
};

export const getPresetSettings = (presets: PresetsState): IPresetSetting[] => {
  if (presets.updatingSettings.settings) {
    const presetsLength = presets.updatingSettings.settings.length;

    const defaultSettings = generateStaticActions(
      presets.activePreset.isTemporary ? TEMPORARY_SETTINGS : DEFAULT_SETTING,
      presetsLength
    ).flat() as IPresetSetting[];

    return [
      ...(presets.updatingSettings.settings || []).filter(
        (setting) => !setting.hidden
      ),
      ...defaultSettings
    ];
  }
};

export const addVariablesToSettings = ({
  variables,
  nextId
}: {
  variables: Variable[];
  nextId: number;
}) => {
  if (!variables) return [];
  if (!variables.length) return [];

  const settings: IPresetBaseNumerical[] = variables.map((variable, index) => ({
    id: index + nextId,
    type: 'numerical',
    isInternal: false,
    externalType: variable.type,
    key: variable.key,
    label: variable.name,
    value: variable.value
  }));

  return settings;
};
