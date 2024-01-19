import { useEffect } from 'react';
// eslint-disable-next-line
// @ts-ignore
import pingSound from '../assets/ping.mp3';
import { StageType } from '../types';
import { useAppSelector } from '../components/store/hooks';

export const usePlaySound = (status: StageType) => {
  const { isSoundEnable } = useAppSelector((state) => state.settings);

  if (!status || !isSoundEnable) return;

  const sound = new Audio(pingSound);

  useEffect(() => {
    if (status !== 'idle') {
      sound.play();
    }
  }, [status]);
};
