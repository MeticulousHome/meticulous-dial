import { createNanoEvents } from 'nanoevents';
import { Gesture } from './types';

export interface HandleEvents {
  gesture: (gesture: Gesture) => void;
}

export const handleEvents = createNanoEvents<HandleEvents>();
