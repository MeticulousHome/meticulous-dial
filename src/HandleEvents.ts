import { createNanoEvents } from 'nanoevents';
import { GestureType } from './types';

export interface HandleEvents {
  gesture: (gesture: GestureType) => void;
}

export const handleEvents = createNanoEvents<HandleEvents>();
