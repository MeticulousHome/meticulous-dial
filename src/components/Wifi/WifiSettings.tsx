import React, { useState } from 'react';
import { SwiperSlide } from 'swiper/react';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { updateConfig } from '../store/features/wifi/wifi-slice';
import { setScreen } from '../store/features/screens/screens-slice';
import { AppMode } from '../../types';
import { SwiperWrapper } from '../Swiper/SwiperWrapper';

import './wifiSettings.css';

const LARGE_CONTENT_SETTINGS = {} as const;

enum SETTING_OPTIONS {
  WIFI_DETAILS = 'wifi-details',
  CONNECT_NEW_WIFI = 'connect-new-wifi',
  TOGGLE_WIFI_MODE = 'toggle-wifi-mode',
  CONNECT_TO_THE_MACHINE = 'connect-to-the-machine',
  SCAN_TO_CONNECT_WIFI = 'scan-to-connect-wifi',
  SCAN_TO_CONNECT_MACHINE = 'scan-to-connect-machine'
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
  height: '180px'
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
      dispatch(
        updateConfig({
          ...networkConfig,
          mode: networkConfig.mode === AppMode.AP ? AppMode.CLIENT : AppMode.AP
        })
      );
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
            <div className={`${animationStyle} center`}>
              status: &nbsp;
              {isWifiConnected ? 'connected' : 'not connected'}
            </div>
          </SwiperSlide>

          {isWifiConnected && (
            <>
              <SwiperSlide
                id={SETTING_OPTIONS.WIFI_DETAILS}
                key="wifi-config"
                className="wifi-option-item"
                style={SMALL_SLIDE_STYLE}
              >
                <div className={`${animationStyle} center`}>
                  see current configuration
                </div>
              </SwiperSlide>
              <SwiperSlide
                key="app-mode"
                id={SETTING_OPTIONS.TOGGLE_WIFI_MODE}
                className="wifi-option-item"
                style={SMALL_SLIDE_STYLE}
              >
                <div className={`${animationStyle} center`}>
                  network mode: &nbsp; {networkConfig?.mode}
                </div>
              </SwiperSlide>
            </>
          )}

          {(!isWifiConnected || isClientMode) && (
            <SwiperSlide
              key="connect-wifi"
              id={SETTING_OPTIONS.CONNECT_NEW_WIFI}
              className="wifi-option-item"
              style={SMALL_SLIDE_STYLE}
            >
              <div className={`${animationStyle} center`}>
                connect to a new network
              </div>
            </SwiperSlide>
          )}

          {isAppMode && (
            <>
              <SwiperSlide
                id={SETTING_OPTIONS.CONNECT_TO_THE_MACHINE}
                key="app-details"
                className="wifi-option-item"
                style={LARGE_SLIDE_STYLE}
              >
                <div className={`${animationStyle} center`}>
                  <div>connect to the machine:</div>
                  <div className="wifi-item">{`network: ${wifiStatus?.connection_name}`}</div>
                  <div className="wifi-item">{`hostname: ${wifiStatus?.hostname}`}</div>
                </div>
              </SwiperSlide>
              <SwiperSlide
                key="app-credentials-name"
                className="wifi-option-item"
                style={SMALL_SLIDE_STYLE}
              >
                <div className={`${animationStyle} center`}>
                  <div className="wifi-item">{`app name: ${networkConfig?.apName}`}</div>
                </div>
              </SwiperSlide>
              <SwiperSlide
                key="app-credentials-password"
                className="wifi-option-item"
                style={SMALL_SLIDE_STYLE}
              >
                <div className={`${animationStyle} center`}>
                  <div className="wifi-item">{`app password: ${networkConfig?.apPassword}`}</div>
                </div>
              </SwiperSlide>
              <SwiperSlide
                id={SETTING_OPTIONS.SCAN_TO_CONNECT_WIFI}
                key="wifi-qr"
                className="wifi-option-item"
                style={LARGE_SLIDE_STYLE}
              >
                <div className={`${animationStyle} center`}>
                  scan to connect wifi:
                  <div className="qr-wrapper"></div>
                </div>
              </SwiperSlide>
            </>
          )}

          {isClientMode && (
            <>
              <SwiperSlide
                id={SETTING_OPTIONS.SCAN_TO_CONNECT_MACHINE}
                key="wifi-qr"
                className="wifi-option-item"
                style={LARGE_SLIDE_STYLE}
              >
                <div className={`${animationStyle} center`}>
                  scan to connect to this machine:
                  <div className="qr-wrapper"></div>
                </div>
              </SwiperSlide>
            </>
          )}
        </SwiperWrapper>
      </div>
    </div>
  );
};
