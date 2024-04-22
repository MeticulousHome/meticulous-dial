import { useEffect, useState } from 'react';
import { Swiper, SwiperSlide } from 'swiper/react';

import { setBubbleDisplay } from '../store/features/screens/screens-slice';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { useHandleGestures } from '../../hooks/useHandleGestures';
import { deleteKnowWifiThunk } from '../store/features/wifi/wifi-slice';

const items = [{ key: 'delete' }, { key: 'back' }];

export const DeleteWifiMenu = (): JSX.Element => {
  const dispatch = useAppDispatch();
  const [swiper, setSwiper] = useState(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const { pending, selectedWifiToDelete } = useAppSelector(
    (state) => state.wifi
  );

  useHandleGestures({
    left() {
      setActiveIndex((prev) => Math.max(prev - 1, 0));
    },
    right() {
      setActiveIndex((prev) => Math.min(prev + 1, items.length - 1));
    },
    pressDown() {
      switch (items[activeIndex].key) {
        case 'delete': {
          dispatch(deleteKnowWifiThunk({ ssid: selectedWifiToDelete }));
          dispatch(
            setBubbleDisplay({ visible: true, component: 'deletedWifi' })
          );
          break;
        }
        case 'back': {
          dispatch(setBubbleDisplay({ visible: true, component: 'KnownWifi' }));
          break;
        }
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

  return (
    <div className="main-quick-settings">
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
          key="delete"
          className={`settings-item ${
            items[activeIndex].key === 'delete' ? 'active-setting' : ''
          }`}
        >
          <div>Delete</div>
        </SwiperSlide>
        <SwiperSlide
          key="back"
          className={`settings-item ${
            items[activeIndex].key === 'back' ? 'active-setting' : ''
          }`}
        >
          <div style={{ height: '30px' }}>Back</div>
        </SwiperSlide>
      </Swiper>
    </div>
  );
};
