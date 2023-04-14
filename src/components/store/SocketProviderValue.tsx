// import { ThunkDispatch } from '@reduxjs/toolkit';
import { useEffect } from 'react';
import { io, Socket } from 'socket.io-client';

import { ActionType, ISensorData } from '../../types/index';
import { setGesture } from './features/gestures/gestures-slice';
import { useAppDispatch, useAppSelector } from './hooks';
import { setStats } from './features/stats/stats-slice';
import { generatePayload } from '../../utils/preheat';

interface SocketProviderValueInterface {
  sendAction: (name: ActionType) => void;
  sendPreset: (name: string) => void;
}

const socket: Socket | null = io('http://localhost:8080');

export const SocketProviderValue = (): SocketProviderValueInterface => {
  const dispatch = useAppDispatch();

  useEffect(() => {
    /* socket.on("connect", () => {
            //dispatch
        }); */
    /* socket.on("disconnect", () => {
            //
        }); */
    socket.on('status', (data: ISensorData) => {
      console.log('Listening: status ');
      dispatch(setStats(data));
    });
  }, []);

  // const sendAction = (name: ActionType) => {
  //   socket.emit("action", name.toLowerCase());
  // };

  // const sendPreset = (name: string) => {
  //   socket.emit("preset", name.toLowerCase());
  // };

  // return { sendAction, sendPreset };
  return;
};

const presset = {
  name: 'prueba',
  settings: [
    {
      id: 1,
      type: 'text',
      key: 'name',
      label: 'name',
      value: '78 a'
    },
    {
      id: 2,
      type: 'numerical',
      key: 'pressure',
      label: 'pressure',
      value: 9,
      unit: 'bar'
    },
    {
      id: 3,
      type: 'numerical',
      key: 'temperature',
      label: 'temperature',
      value: '85',
      unit: '°c'
    },
    {
      id: 4,
      type: 'on-off',
      key: 'pre-infusion',
      label: 'pre-infusion',
      value: 'yes'
    },
    {
      id: 5,
      type: 'numerical',
      key: 'output',
      label: 'output',
      value: '36',
      unit: 'g'
    },
    {
      id: 6,
      type: 'multiple-option',
      key: 'purge',
      label: 'purge',
      value: 'automatic'
    },
    {
      id: 7,
      type: 'action',
      key: 'save',
      label: 'save'
    },
    {
      id: 8,
      type: 'action',
      key: 'discard',
      label: 'discard'
    }
  ]
};

export const SetSocketKeyboardListeners = () => {
  const dispatch = useAppDispatch();
  const { presets, presetSetting, screen, settings } = useAppSelector(
    (state) => state
  );

  useEffect(() => {
    const lister = (e: KeyboardEvent) => {
      const preset = {
        name: presets.activePreset.name,
        settings: presetSetting.settings.settings.filter(
          (item) => item.id !== -1 && item.id !== -2
        )
      };

      const payload = generatePayload({ presset: preset as any });
      console.log(e.code);
      switch (e.code) {
        case 'ArrowLeft':
          dispatch(setGesture('left'));
          break;
        case 'ArrowRight':
          dispatch(setGesture('right'));
          break;
        case 'Space':
          if (
            screen.value === 'settings' &&
            settings.settings[settings.activeIndexSetting]
          ) {
            switch (settings.settings[settings.activeIndexSetting].key) {
              case 'home':
                socket.emit('parameters', payload);
                socket.emit('action', 'home');
                break;
              case 'purge':
                socket.emit('parameters', payload);
                socket.emit('action', 'purge');
                break;
              case 'calibrate':
                socket.emit('parameters', payload);
                socket.emit('calibrate');
                break;
              default:
                break;
            }
          }
          dispatch(setGesture('click'));
          break;
        case 'Enter': {
          if (screen.value !== 'barometer') return;

          console.log(JSON.stringify(payload, null, 2));

          socket.emit('parameters', payload);
          socket.emit('action', 'start');
          dispatch(setGesture('start'));
          break;
        }
        case 'KeyS':
          dispatch(setGesture('longTare'));
          break;
        case 'KeyE':
          dispatch(setGesture('longEncoder'));
          break;
        case 'KeyD':
          dispatch(setGesture('doubleTare'));
          break;
        case 'KeyX':
          dispatch(setGesture('doubleClick'));
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', lister);

    return () => {
      window.removeEventListener('keydown', lister);
    };
  }, [presets, presetSetting, screen, settings]);

  return dispatch;
};
