import { ThunkDispatch } from '@reduxjs/toolkit';
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

//@ts-ignore
//const socket: Socket | null = io(window.meticulous_envs.SERVER_URL());

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

  const sendAction = (name: ActionType) => {
    //socket.emit("action", name.toLowerCase());
  };

  const sendPreset = (name: string) => {
    //socket.emit("preset", name.toLowerCase());
  };

  return { sendAction, sendPreset };
};

export const SetSocketKeyboardListeners = () => {
  const dispatch = useAppDispatch();

  useEffect(() => {
    window.addEventListener('keydown', (e) => {
      switch (e.code) {
        case 'ArrowLeft':
          //dispatch(setGesture('left'));
          break;
        case 'ArrowRight':
          dispatch(setGesture('right'));
          break;
        case 'Space':
          dispatch(setGesture('click'));
          break;
        default:
          break;
      }
    });
  }, []);
};
