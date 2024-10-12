import { useEffect, useState } from 'react';
import { Swiper, SwiperSlide } from 'swiper/react';
import { useHandleGestures } from '../../hooks/useHandleGestures';
import { setBubbleDisplay } from '../store/features/screens/screens-slice';
import { useAppDispatch } from '../store/hooks';
import { useSocket } from '../../../src/components/store/SocketManager';
import { getOSStatus } from '../../api/api';

import './OSStatus.css';

export interface OSUpdateData {
  progress?: number;
  status?: string;
  info?: string;
}

export const InitialOSStatus: OSUpdateData = {
  progress: 0,
  status: 'IDLE',
  info: ''
};

const items = [{ key: 'content' }, { key: 'back' }];

export const OSStatus = (): JSX.Element => {
  const socket = useSocket();

  const [OSStatusData, setOSStatusData] = useState(InitialOSStatus);
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

    if (OSStatusData.status === 'IDLE') {
      setInfo(UpToDateMesage);
    } else {
      switch (OSStatusData.status) {
        case 'COMPLETE':
          setInfo(UpToDateMesage + ' Reboot your machine ');
          break;
        case 'FAILED':
          setInfo('OS Could not be updated. Error: ' + OSStatusData.info);
          break;
        default:
          setInfo(
            OSStatusData.status + ' Update \n' + OSStatusData.progress + '%'
          );
          break;
      }
    }
  }, [OSStatusData]);

  useEffect(() => {
    getOSStatus().then((data) => setOSStatusData(data));
    socket.on('OSUpdate', (data: OSUpdateData) => {
      setOSStatusData(data);
    });
  }, []);

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
          <div className="OS-info-text">{info}</div>
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
