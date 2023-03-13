// import { ThunkDispatch } from '@reduxjs/toolkit';
import { useEffect } from 'react';
import { io, Socket } from 'socket.io-client';

import { ActionType, ISensorData } from '../../types/index';
import { setGesture } from './features/gestures/gestures-slice';
import { useAppDispatch } from './hooks';
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
      value: '78U+002a'
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

  useEffect(() => {
    window.addEventListener('keydown', (e) => {
      console.log(e.code);
      switch (e.code) {
        case 'ArrowLeft':
          dispatch(setGesture('left'));
          break;
        case 'ArrowRight':
          dispatch(setGesture('right'));
          break;
        case 'Space':
          dispatch(setGesture('click'));
          break;
        case 'Enter': {
          const payload = generatePayload({ presset: presset as any });
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
    });
  }, []);

  return dispatch;
};
