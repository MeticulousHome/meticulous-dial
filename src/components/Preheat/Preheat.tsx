import { useEffect, useState } from 'react';
import './preheat.css';
import { useHandleGestures } from '../../../src/hooks/useHandleGestures';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { Gauge } from '../SettingNumerical/Gauge';
import { setBubbleDisplay } from '../store/features/screens/screens-slice';
import { roundPrecision } from '../../../src/utils';
import { updateSettings } from '../store/features/settings/settings-slice';

import { Swiper, SwiperSlide } from 'swiper/react';
import { YesNoEnum } from '../../../src/types';

const options: YesNoEnum[] = [YesNoEnum.Yes, YesNoEnum.No];

const MAX_PREHEAT = 99;
const MIN_PREHEAT = 25;
const INTERVAL_PREHEAT = 1;

export function QuickPreheat(): JSX.Element {
  const [swiper, setSwiper] = useState(null);
  const [activeIndex, setActiveIndex] = useState<number>(0);
  const [optionSelected, setOptionSelected] = useState<YesNoEnum>(YesNoEnum.No);
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
    const mTotalValue =
      mTotal <= MIN_PREHEAT ? MIN_PREHEAT : roundPrecision(mTotal, 1);

    setTotal(mTotalValue || MIN_PREHEAT);
  };

  const updatePreheat = () => {
    dispatch(
      updateSettings({
        auto_preheat: optionSelected === YesNoEnum.Yes ? total : 0
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
    pressDown() {
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
          optionSelected === YesNoEnum.Yes ? YesNoEnum.No : YesNoEnum.Yes
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
    setOptionSelected(auto_preheat === 0 ? YesNoEnum.No : YesNoEnum.Yes);
    setTotal(auto_preheat === 0 ? MIN_PREHEAT : auto_preheat);
  }, [auto_preheat]);

  return (
    <div className="preheat-container">
      {showGauge && (
        <div className="g-container">
          <Gauge
            value={total || MIN_PREHEAT}
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
            ENABLED: {optionSelected.toUpperCase()}
          </SwiperSlide>
          <SwiperSlide
            key={1}
            className={`settings-item ${
              1 === activeIndex ? 'active-setting' : ''
            }`}
          >
            VALUE: {total || MIN_PREHEAT}°C
          </SwiperSlide>
          <SwiperSlide
            key={2}
            className={`settings-item ${
              2 === activeIndex ? 'active-setting' : ''
            }`}
          >
            BACK
          </SwiperSlide>
        </Swiper>
      )}
    </div>
  );
}
