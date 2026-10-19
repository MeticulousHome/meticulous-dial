// Transport boundary only: the production SocketProviderValue maps each event
// to gestures and resets idle. No real socket or machine action is permitted.
type Listener = (...args: unknown[]) => void;
const listeners = new Map<string, Set<Listener>>();
const socket = {
  connected: false,
  on(event: string, listener: Listener) {
    if (!listeners.has(event)) listeners.set(event, new Set());
    listeners.get(event)!.add(listener);
    return socket;
  },
  off(event: string, listener?: Listener) {
    if (listener) listeners.get(event)?.delete(listener);
    else listeners.delete(event);
    return socket;
  },
  emit() {
    throw new Error('Unexpected outbound Socket.IO event in screen fixture');
  }
};
export const io = () => socket;
export const receiveButton = (type: string) => {
  const handlers = listeners.get('button');
  if (!handlers?.size) throw new Error('Production button listener not ready');
  for (const listener of handlers)
    listener({ type, time_since_last_event: 100 });
};
export const buttonListenerReady = () => !!listeners.get('button')?.size;
