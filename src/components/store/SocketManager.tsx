import { createContext, ReactNode, useContext } from 'react';

import {
  SetSocketKeyboardListeners,
  SocketProviderValue
} from './SocketProviderValue';

// socket context
export const SocketContext = createContext(null);

// allow consuming socket context anywhere
export const useSocket = () => {
  return useContext(SocketContext);
};

export const SocketManager = ({
  children
}: {
  children: ReactNode;
}): JSX.Element => {
  SocketProviderValue();
  const dispatch = SetSocketKeyboardListeners();
  return (
    <SocketContext.Provider value={dispatch}>{children}</SocketContext.Provider>
  );
};
