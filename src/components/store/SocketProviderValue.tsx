// import { ThunkDispatch } from '@reduxjs/toolkit';
import { useEffect } from 'react';
// import { io } from "socket.io-client";
import { StageType, ActionType } from '../../types/index';
import { useAppDispatch } from './hooks';
import { setGesture } from './features/gestures/gestures-slice';

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

// const socket: Socket | null = io(window.meticulous_envs.SERVER_URL());

export const SocketProviderValue = (): SocketProviderValueInterface => {
  useEffect(() => {
    /* socket.on("connect", () => {
            //dispatch
        }); */
    /* socket.on("disconnect", () => {
            //
        }); */
    /* socket.on("status", (data: SensorDataInterface) => {
            //dispatch
        }); */
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

  let lastSpaceDownTime = 0;

  useEffect(() => {
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space' && e.timeStamp - lastSpaceDownTime < 300) {
        dispatch(setGesture('doubleClick'));
        return;
      }

      switch (e.code) {
        case 'ArrowLeft':
          dispatch(setGesture('left'));
          break;
        case 'ArrowRight':
          dispatch(setGesture('right'));
          break;
        case 'Space':
          lastSpaceDownTime = e.timeStamp;
          dispatch(setGesture('click'));
          break;
        default:
          break;
      }
    });
  }, []);
};
