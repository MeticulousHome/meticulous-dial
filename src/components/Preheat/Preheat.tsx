import { useEffect, useState } from 'react';
import './preheat.css';
import { useHandleGestures } from '../../../src/hooks/useHandleGestures';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { Gauge } from '../SettingNumerical/Gauge';
import { setBubbleDisplay } from '../store/features/screens/screens-slice';
import { roundPrecision } from '../../../src/utils';
import { updateSettings } from '../store/features/settings/settings-slice';

import { Swiper, SwiperSlide } from 'swiper/react';

enum OptionType {
  yes = 'yes',
  no = 'no'
}

const options: OptionType[] = [OptionType.yes, OptionType.no];

const MAX_PREHEAT = 99;
const MIN_PREHEAT = 25;
const INTERVAL_PREHEAT = 1;

export function QuickPreheat(): JSX.Element {
  const [swiper, setSwiper] = useState(null);
  const [activeIndex, setActiveIndex] = useState<number>(0);
  const [optionSelected, setOptionSelected] = useState<OptionType>(
    OptionType.no
  );
  const [showGauge, setShowGauge] = useState<boolean>(false);
  const [total, setTotal] = useState<number>(MIN_PREHEAT);
  const { auto_preheat } = useAppSelector((state) => state.settings);
  const dispatch = useAppDispatch();

  const updateValue = (gesture: 'left' | 'right') => {
    if (
      (total === MAX_PREHEAT && gesture === 'right') ||
      (total === 0 && gesture === 'left')
    ) {
      return;
    }
    const mTotal =
      total + (gesture === 'left' ? -INTERVAL_PREHEAT : +INTERVAL_PREHEAT);
    setTotal(mTotal <= MIN_PREHEAT ? MIN_PREHEAT : roundPrecision(mTotal, 1));
  };

  const updatePreheat = () => {
    dispatch(
      updateSettings({
        auto_preheat: optionSelected === OptionType.yes ? total : 0
      })
    );
  };

  useHandleGestures({
    right() {
      if (showGauge) {
        updateValue('right');
        return;
      }

      setActiveIndex((prev) => Math.min(prev + 1, options.length));
    },
    left() {
      if (showGauge) {
        updateValue('left');
        return;
      }
      setActiveIndex((prev) => Math.max(prev - 1, 0));
    },
    click() {
      if (activeIndex === 2) {
        dispatch(
          setBubbleDisplay({ visible: true, component: 'quick-settings' })
        );
        updatePreheat();
      }

      if (showGauge && activeIndex === 1) {
        setShowGauge(false);
        return;
      }

      if (activeIndex === 0) {
        setOptionSelected(
          optionSelected === OptionType.yes ? OptionType.no : OptionType.yes
        );
      }

      if (activeIndex === 1) {
        setShowGauge(true);
      }
    }
  });

  useEffect(() => {
    if (swiper) {
      swiper.slideTo(activeIndex, 0, false);
    }
  }, [activeIndex, swiper]);

  useEffect(() => {
    setOptionSelected(auto_preheat === 0 ? OptionType.no : OptionType.yes);
    setTotal(auto_preheat === 0 ? MIN_PREHEAT : auto_preheat);
  }, [auto_preheat]);

  return (
    <div className="preheat-container">
      {showGauge && (
        <div className="g-container">
          <Gauge
            value={total}
            maxValue={MAX_PREHEAT}
            precision={1}
            unit="celcius"
          />
        </div>
      )}
      {!showGauge && (
        <Swiper
          onSwiper={setSwiper}
          slidesPerView={8}
          allowTouchMove={false}
          direction="vertical"
          spaceBetween={25}
          autoHeight={false}
          centeredSlides={true}
          initialSlide={activeIndex}
          style={{ paddingLeft: '29px', top: '-4px' }}
        >
          <SwiperSlide
            key={0}
            className={`settings-item ${
              0 === activeIndex ? 'active-setting' : ''
            }`}
          >
            <div style={{ height: '30px' }}>
              <div className="settings-entry text-container">
                <span
                  className="settings-text"
                  style={{ wordBreak: 'break-word' }}
                >
                  ENABLED: {optionSelected.toUpperCase()}
                </span>
              </div>
            </div>
          </SwiperSlide>
          <SwiperSlide
            key={1}
            className={`settings-item ${
              1 === activeIndex ? 'active-setting' : ''
            }`}
          >
            <div>VALUE: {total}°C</div>
          </SwiperSlide>
          <SwiperSlide
            key={2}
            className={`settings-item ${
              2 === activeIndex ? 'active-setting' : ''
            }`}
          >
            <div>BACK</div>
          </SwiperSlide>
        </Swiper>
      )}
    </div>
  );
}
