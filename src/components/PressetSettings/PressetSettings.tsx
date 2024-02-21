import { useEffect, useMemo, useState } from 'react';
import { Swiper, SwiperSlide } from 'swiper/react';
import { IPresetSetting } from '../../types';
import { useAppDispatch, useAppSelector } from '../store/hooks';

import './pressetSettings.css';
import { generateDefaultAction } from '../../utils/preset';
import { useHandleGestures } from '../../hooks/useHandleGestures';
import {
  deletePreset,
  savePreset,
  discardSettings,
  setNextSettingOption,
  setPrevSettingOption
} from '../store/features/preset/preset-slice';
import { setScreen } from '../store/features/screens/screens-slice';
import { KIND_PROFILE } from '../../constants';

interface FormatSettingProps {
  setting: IPresetSetting;
  isActive: boolean;
}

const formatSetting = ({ setting, isActive }: FormatSettingProps) => {
  const { label, value } = setting;
  let mValue = '';
  let mLabel = label;
  let activeClass = isActive ? 'active' : '';
  const isValidType = typeof value === 'number' || typeof value === 'string';

  if ((value || label) && isValidType) {
    mLabel = `${label}${isActive ? ': ' : ''}`;
    mValue = `${value || ''}`;
  }

  if (label === 'delete profile') activeClass = '';

  return (
    <div>
      <span className={`capitalize presset-option-label ${activeClass}`}>
        {mLabel}
      </span>
      <span className={`presset-option-value ${activeClass}`}>{mValue}</span>
      <span className={`presset-option-unit ${activeClass}`}>
        {(setting as any)?.unit}
      </span>
    </div>
  );
};

export function PressetSettings(): JSX.Element {
  const dispatch = useAppDispatch();
  const bubbleDisplay = useAppSelector((state) => state.screen.bubbleDisplay);
  const [animationStyle, setAnimationStyle] = useState('');
  const [swiper, setSwiper] = useState(null);
  const currentPresetSetting = useAppSelector(
    (state) => state.presets.activePreset?.settings || []
  );
  const presets = useAppSelector((state) => state.presets);
  const settings = useMemo(() => {
    const defaultSettings = generateDefaultAction(
      presets.updatingSettings.settings.length
    ).flat() as IPresetSetting[];

    if (
      presets.activePreset.kind &&
      presets.activePreset.kind !== KIND_PROFILE.ITALIAN
    ) {
      return [
        ...presets.updatingSettings.settings.filter(
          (setting) => setting.key === 'name'
        ),
        ...defaultSettings
      ];
    } else {
      return [
        ...(presets.updatingSettings.settings || []).filter(
          (setting) => !setting.hidden
        ),
        ...defaultSettings
      ];
    }
  }, [presets.updatingSettings.settings]);
  const [presetSettingIndex, setPresetSettingIndex] = useState<
    IPresetSetting['key']
  >(settings[presets.activeSetting].key);

  useHandleGestures(
    {
      left() {
        dispatch(setPrevSettingOption());
      },
      right() {
        dispatch(setNextSettingOption());
      },
      click() {
        if (presetSettingIndex === 'save') {
          dispatch(savePreset());
          dispatch(setScreen('pressets'));
        } else if (presetSettingIndex == 'discard') {
          dispatch(discardSettings());
          dispatch(setScreen('pressets'));
        } else if (presetSettingIndex === 'delete') {
          dispatch(deletePreset());
          dispatch(setScreen('pressets'));
        } else if (presetSettingIndex === 'name') {
          dispatch(setScreen('name'));
        } else if (presetSettingIndex === 'pre-infusion') {
          dispatch(setScreen('pre-infusion'));
        } else if (presetSettingIndex === 'purge') {
          dispatch(setScreen('purge'));
        } else if (presetSettingIndex === 'pre-heat') {
          dispatch(setScreen('pre-heat'));
        } else if (presetSettingIndex === 'output') {
          dispatch(setScreen('output'));
        } else if (presetSettingIndex === 'pressure') {
          dispatch(setScreen('pressure'));
        } else if (presetSettingIndex === 'temperature') {
          dispatch(setScreen('temperature'));
        } else if (presetSettingIndex === 'ratio') {
          dispatch(setScreen('ratio'));
        }
      }
    },
    bubbleDisplay.visible
  );

  useEffect(() => {
    if (swiper) {
      const settingsExist =
        currentPresetSetting && currentPresetSetting.length > 0;

      let settingBeforeChange;

      if (settingsExist && currentPresetSetting[swiper['activeIndex']]) {
        settingBeforeChange = currentPresetSetting[swiper['activeIndex']].key;
      }

      if (
        (settingBeforeChange === 'save' || settingBeforeChange === 'discard') &&
        presets.activeSetting === 2
      ) {
        swiper.slideTo(presets.activeSetting, 0, false);
      } else {
        swiper.slideTo(presets.activeSetting);
      }

      if (settingsExist) {
        setPresetSettingIndex(settings[presets.activeSetting].key);
      }
    }
  }, [presets.activeSetting, swiper]);

  useEffect(() => {
    if (
      presets.activePreset &&
      currentPresetSetting.length > 0 &&
      currentPresetSetting[presets.activeSetting] &&
      settings[presets.activeSetting]?.key
    ) {
      setPresetSettingIndex(settings[presets.activeSetting].key);
    }
  }, [presets.activePreset.settings]);

  useEffect(() => {
    return () => {
      setAnimationStyle('');
    };
  }, []);

  return (
    <div className="presset-container">
      <div className="presset-options">
        <Swiper
          onSwiper={setSwiper}
          slidesPerView={9}
          allowTouchMove={false}
          direction="vertical"
          autoHeight={false}
          centeredSlides={true}
          initialSlide={presets.activeSetting}
          onSlideNextTransitionStart={() => {
            setAnimationStyle('animation-next');
          }}
          onSlidePrevTransitionStart={() => setAnimationStyle('animation-prev')}
          onSlideChangeTransitionEnd={() => setAnimationStyle('')}
        >
          {settings.map((setting, index: number) => (
            <SwiperSlide
              className="presset-option-item"
              key={`option-${index}`}
            >
              <div
                className={`${animationStyle} ${
                  setting.key === 'delete' ? 'delete-option-item' : ''
                }`}
              >
                {formatSetting({
                  setting,
                  isActive:
                    settings[presets.activeSetting].label === setting.label
                })}
              </div>
            </SwiperSlide>
          ))}
        </Swiper>
      </div>
      <div className="fade fade-top"></div>
      <div className="fade fade-bottom"></div>
    </div>
  );
}
