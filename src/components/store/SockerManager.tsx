import React, { createContext, ReactNode, useContext } from 'react';
import { SetSocketKeyboardListeners } from './SocketProviderValue';

// socket context
const SockerContext = createContext(null);

// allow consuming socket context anywhere
export const useSocket = () => {
  return useContext(SockerContext);
};

export const SockerManager = ({
  children
}: {
  children: ReactNode;
}): JSX.Element => {
  SetSocketKeyboardListeners();
  return <SockerContext.Provider value={{}}>{children}</SockerContext.Provider>;
};
