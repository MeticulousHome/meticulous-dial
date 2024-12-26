import { createContext, ReactNode, useContext } from 'react';

import { SocketProviderValue } from './SocketProviderValue';

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
  const { socket, profileChangeData } = SocketProviderValue();
  return (
    <SocketContext.Provider value={{ socket, profileChangeData }}>
      {children}
    </SocketContext.Provider>
  );
};
