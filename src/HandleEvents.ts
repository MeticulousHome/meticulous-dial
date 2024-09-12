import { createNanoEvents } from 'nanoevents';
import { GestureType } from './types';

export interface HandleEvents {
  gesture: (gesture: GestureType, time_since_last_event: number) => void;
}

export const handleEvents = createNanoEvents<HandleEvents>();
