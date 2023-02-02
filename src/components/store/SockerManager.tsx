import React, { createContext, ReactNode, useContext } from 'react';
import { SetSocketKeyboardListeners } from './SocketProviderValue';

// socket context
export const SockerContext = createContext(null);

// allow consuming socket context anywhere
export const useSocket = () => {
  return useContext(SockerContext);
};

export const SockerManager = ({
  children
}: {
  children: ReactNode;
}): JSX.Element => {
  const dispatch = SetSocketKeyboardListeners();
  return (
    <SockerContext.Provider value={dispatch}>{children}</SockerContext.Provider>
  );
};
