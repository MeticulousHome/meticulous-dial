import { useEffect, useMemo, useState } from 'react';
import 'swiper/css';
import { Swiper, SwiperSlide } from 'swiper/react';

import { useHandleGestures } from '../../hooks/useHandleGestures';
import { IPresetSetting } from '../../types';
import { getPresetSettings } from '../../utils/preset';
import {
  discardSettings,
  savePreset,
  setNextSettingOption,
  setPrevSettingOption
} from '../store/features/preset/preset-slice';
import { setScreen } from '../store/features/screens/screens-slice';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { FormatSetting } from './FormatSetting';
import './pressetSettings.css';

export function PressetSettings(): JSX.Element {
  const dispatch = useAppDispatch();
  const bubbleDisplay = useAppSelector((state) => state.screen.bubbleDisplay);
  const [animationStyle, setAnimationStyle] = useState('');
  const [swiper, setSwiper] = useState(null);
  const presets = useAppSelector((state) => state.presets);
  const currentPresetSetting = useAppSelector(
    (state) => state.presets.activePreset?.settings || []
  );

  const settings = useMemo(() => {
    return getPresetSettings(presets);
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
      pressDown() {
        if (presetSettingIndex === 'save') {
          dispatch(savePreset());
          dispatch(setScreen('pressets'));
        } else if (presetSettingIndex == 'discard') {
          dispatch(discardSettings());
          dispatch(setScreen('pressets'));
        } else if (presetSettingIndex === 'name') {
          dispatch(setScreen('name'));
        } else if (presetSettingIndex === 'output') {
          dispatch(setScreen('output'));
        } else if (presetSettingIndex.includes('pressure')) {
          dispatch(setScreen('pressure'));
        } else if (presetSettingIndex.includes('time')) {
          dispatch(setScreen('time'));
        } else if (presetSettingIndex.includes('weight')) {
          dispatch(setScreen('weight'));
        } else if (presetSettingIndex.includes('flow')) {
          dispatch(setScreen('flow'));
        } else if (presetSettingIndex === 'temperature') {
          dispatch(setScreen('temperature'));
        } else if (presetSettingIndex === 'image') {
          dispatch(setScreen('pressetProfileImage'));
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
                <FormatSetting
                  setting={setting}
                  isActive={
                    settings[presets.activeSetting].label === setting.label
                  }
                />
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
