import React, { useState } from 'react';
import { SwiperSlide } from 'swiper/react';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { updateConfig } from '../store/features/wifi/wifi-slice';
import { setScreen } from '../store/features/screens/screens-slice';
import { AppMode } from '../../types';
import { SwiperWrapper } from '../Swiper/SwiperWrapper';

import './wifiSettings.css';
import { QrImage } from './QrImage';

enum SETTING_OPTIONS {
  WIFI_DETAILS = 'wifi-details',
  CONNECT_NEW_WIFI = 'connect-new-wifi',
  TOGGLE_WIFI_MODE = 'toggle-wifi-mode',
  CONNECT_TO_THE_MACHINE = 'connect-to-the-machine',
  SCAN_TO_CONNECT_WIFI = 'scan-to-connect-wifi',
  SCAN_TO_CONNECT_MACHINE = 'scan-to-connect-machine',
  EXIT = 'exit'
}

const LARGE_CONTENT_OPTIONS = [
  SETTING_OPTIONS.CONNECT_TO_THE_MACHINE,
  SETTING_OPTIONS.SCAN_TO_CONNECT_MACHINE,
  SETTING_OPTIONS.SCAN_TO_CONNECT_WIFI
];

const SMALL_SLIDE_STYLE = {
  height: '60px'
};

const LARGE_SLIDE_STYLE = {
  height: '200px'
};

export const WifiSettings = (): JSX.Element => {
  const [animationStyle, setAnimationStyle] = useState('');
  const { wifiStatus, networkConfig } = useAppSelector((state) => state.wifi);

  const isWifiConnected = wifiStatus?.connected;
  const isAppMode = isWifiConnected && networkConfig?.mode === AppMode.AP;
  const isClientMode =
    isWifiConnected && networkConfig?.mode === AppMode.CLIENT;

  const dispatch = useAppDispatch();

  const onClick = (activeSlideId: SETTING_OPTIONS) => {
    if (activeSlideId === SETTING_OPTIONS.WIFI_DETAILS) {
      dispatch(setScreen('wifiDetails'));
    }
    if (activeSlideId === SETTING_OPTIONS.CONNECT_NEW_WIFI) {
      dispatch(setScreen('connectWifi'));
    }
    if (activeSlideId === SETTING_OPTIONS.TOGGLE_WIFI_MODE) {
      const mode =
        networkConfig.mode === AppMode.AP ? AppMode.CLIENT : AppMode.AP;
      dispatch(updateConfig({ ...networkConfig, mode }));
    }

    if (activeSlideId === SETTING_OPTIONS.EXIT) {
      dispatch(setScreen('pressets'));
    }
  };

  return (
    <div className="main-layout">
      <div className="wifi-options">
        <SwiperWrapper
          largeContentIds={LARGE_CONTENT_OPTIONS}
          onClick={onClick}
          setAnimationStyle={setAnimationStyle}
        >
          <SwiperSlide
            key="wifi-status"
            className="wifi-option-item"
            style={SMALL_SLIDE_STYLE}
          >
            <div className={`${animationStyle}`}>
              Status: &nbsp;
              {isWifiConnected ? 'connected' : 'not connected'}
            </div>
          </SwiperSlide>

          {isWifiConnected && (
            <SwiperSlide
              key="app-mode"
              id={SETTING_OPTIONS.TOGGLE_WIFI_MODE}
              className="wifi-option-item"
              style={SMALL_SLIDE_STYLE}
            >
              <div className={`${animationStyle}`}>
                Network mode:{' '}
                {networkConfig?.mode === AppMode.AP ? 'AP' : 'Client'}
              </div>
            </SwiperSlide>
          )}

          {(!isWifiConnected || isClientMode) && (
            <SwiperSlide
              key="connect-wifi"
              id={SETTING_OPTIONS.CONNECT_NEW_WIFI}
              className="wifi-option-item"
              style={SMALL_SLIDE_STYLE}
            >
              <div className={`${animationStyle}`}>
                Connect to a new network
              </div>
            </SwiperSlide>
          )}

          {isAppMode && (
            <>
              <SwiperSlide
                key="app-details"
                className="wifi-option-item"
                style={SMALL_SLIDE_STYLE}
              >
                <div className={`${animationStyle}`}>
                  <div
                    className="wifi-item"
                    style={{ textAlign: 'left' }}
                  >{`Network: ${wifiStatus?.connection_name}`}</div>
                </div>
              </SwiperSlide>
              <SwiperSlide
                className="wifi-option-item"
                style={SMALL_SLIDE_STYLE}
              >
                <div className={`${animationStyle}`}>
                  <div
                    className="wifi-item"
                    style={{ textAlign: 'left' }}
                  >{`Hostname: ${wifiStatus?.hostname}`}</div>
                </div>
              </SwiperSlide>
              <SwiperSlide
                key="app-credentials-name"
                className="wifi-option-item"
                style={SMALL_SLIDE_STYLE}
              >
                <div className={`${animationStyle}`}>
                  <div className="wifi-item">
                    AP name:{' '}
                    <span
                      style={{
                        fontSize:
                          networkConfig?.apName &&
                          networkConfig?.apName.length > 14
                            ? '19px'
                            : undefined
                      }}
                    >
                      {networkConfig?.apName}
                    </span>
                  </div>
                </div>
              </SwiperSlide>
              <SwiperSlide
                key="app-credentials-password"
                className="wifi-option-item"
                style={SMALL_SLIDE_STYLE}
              >
                <div className={`${animationStyle}`}>
                  <div className="wifi-item">{`AP password: ${networkConfig?.apPassword}`}</div>
                </div>
              </SwiperSlide>
              <SwiperSlide
                id={SETTING_OPTIONS.SCAN_TO_CONNECT_WIFI}
                key="wifi-qr"
                className="wifi-option-item"
                style={LARGE_SLIDE_STYLE}
              >
                <div className={`${animationStyle} item-qr`}>
                  Scan to connect
                  <div className="qr-wrapper">
                    <QrImage src={networkConfig.qr} />
                  </div>
                </div>
              </SwiperSlide>
            </>
          )}

          {isClientMode && (
            <SwiperSlide
              id={SETTING_OPTIONS.SCAN_TO_CONNECT_MACHINE}
              key="wifi-qr"
              className="wifi-option-item"
              style={LARGE_SLIDE_STYLE}
            >
              <div className={`${animationStyle} item-qr`}>
                Scan to connect
                <div className="qr-wrapper">
                  <QrImage src={networkConfig.qr} />
                </div>
              </div>
            </SwiperSlide>
          )}

          <SwiperSlide
            id={SETTING_OPTIONS.EXIT}
            key="exit"
            className="wifi-option-item"
            style={SMALL_SLIDE_STYLE}
          >
            <div className={`${animationStyle}`}>Back</div>
          </SwiperSlide>
        </SwiperWrapper>
      </div>
    </div>
  );
};
