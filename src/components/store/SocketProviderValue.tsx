// import { ThunkDispatch } from '@reduxjs/toolkit';
import { useEffect } from 'react';
import { io, Socket } from 'socket.io-client';

import { StageType, ActionType } from '../../types/index';
import { useAppDispatch } from './hooks';
import { setGesture } from './features/gestures/gestures-slice';
import { setStats } from './features/stats/stats-slice';

export interface SensorDataInterface {
  name: StageType;
  sensors: {
    p: string; // Pressure - Bars
    f: string; // Flow - ml/s
    w: string; // Weight - grams
    t: string; // Temperature - degrees celcius
  };
  time: string; // seconds
}

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
    socket.on('status', (data: SensorDataInterface) => {
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

export const SetSocketKeyboardListeners = () => {
  const dispatch = useAppDispatch();

  useEffect(() => {
    window.addEventListener('keydown', (e) => {
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
        case 'Enter':
          dispatch(setGesture('doubleClick'));
          break;
        default:
          break;
      }
    });
  }, []);

  return dispatch;
};
