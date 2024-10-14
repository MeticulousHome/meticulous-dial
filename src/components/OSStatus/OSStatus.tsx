import { useEffect, useState } from 'react';
import { Swiper, SwiperSlide } from 'swiper/react';
import { useHandleGestures } from '../../hooks/useHandleGestures';
import { setBubbleDisplay } from '../store/features/screens/screens-slice';
import { useAppDispatch } from '../store/hooks';

import './OSStatus.css';
import { useOSStatus } from '../../hooks/useOSStatus';

const items = [{ key: 'content' }, { key: 'back' }];

export const OSStatus = (): JSX.Element => {
  const { data: osStatusData, error: osStatusError } = useOSStatus();
  const [info, setInfo] = useState('');

  const [swiper, setSwiper] = useState(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const dispatch = useAppDispatch();

  useHandleGestures({
    left() {
      setActiveIndex((prev) => Math.max(prev - 1, 0));
    },
    right() {
      setActiveIndex((prev) => Math.min(prev + 1, items.length - 1));
    },
    pressDown() {
      switch (items[activeIndex].key) {
        case 'back':
          dispatch(
            setBubbleDisplay({ visible: true, component: 'advancedSettings' })
          );
          break;

        default:
          break;
      }
    }
  });

  useEffect(() => {
    if (swiper) {
      swiper.slideTo(activeIndex, 0, false);
    }
  }, [activeIndex, swiper]);

  useEffect(() => {
    const UpToDateMesage = 'OS up to date.';

    if (osStatusError) {
      setInfo('Failed to get update status');
      return;
    }

    if (osStatusData.status === 'IDLE') {
      setInfo(UpToDateMesage);
    } else {
      switch (osStatusData.status) {
        case 'COMPLETE':
          setInfo(UpToDateMesage + ' Reboot your machine ');
          break;
        case 'FAILED':
          setInfo('OS Could not be updated. Error: ' + osStatusData.info);
          break;
        default:
          setInfo(
            osStatusData.status + ' Update \n' + osStatusData.progress + '%'
          );
          break;
      }
    }
  }, [osStatusData, osStatusError]);

  return (
    <div className="main-quick-settings">
      <Swiper
        onSwiper={setSwiper}
        slidesPerView={8}
        allowTouchMove={false}
        direction="vertical"
        spaceBetween={25}
        autoHeight={false}
        initialSlide={activeIndex}
        centeredSlides={true}
        style={{ paddingLeft: '29px', top: '-4px' }}
      >
        <SwiperSlide key="content">
          <div className="os-info-text">{info}</div>
        </SwiperSlide>
        <SwiperSlide></SwiperSlide>
        <SwiperSlide></SwiperSlide>

        <SwiperSlide
          key="back"
          className={`settings-item ${
            items[activeIndex].key === 'back' ? 'active-setting' : ''
          }`}
        >
          <div className="settings-entry">
            <span>Back</span>
          </div>
        </SwiperSlide>
      </Swiper>
    </div>
  );
};
