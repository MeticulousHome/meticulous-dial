import { createContext, ReactNode, useContext } from 'react';

import { SocketProviderValue } from './SocketProviderValue';
import { useBrewDoubleClick } from '../../hooks/useBrewDoubleClick';

// socket context
export const SocketContext = createContext(null);

// allow consuming socket context anywhere
export const useSocket = () => {
  return useContext(SocketContext);
};

export const useContinueBrewAction = () => {
  const socket = useSocket();
  return () => {
    socket.emit('action', 'continue');
  };
};

export const SocketManager = ({
  children
}: {
  children: ReactNode;
}): JSX.Element => {
  const dispatch = SocketProviderValue();
  // Brew-wide, so a double click reaches the machine from every screen.
  useBrewDoubleClick(dispatch);
  return (
    <SocketContext.Provider value={dispatch}>{children}</SocketContext.Provider>
  );
};
