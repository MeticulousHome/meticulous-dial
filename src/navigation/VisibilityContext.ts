import { createContext, useContext } from 'react';

const visibilityContext = createContext(true);

export const useVisibility = () => useContext(visibilityContext);

export const VisibilityProvider = visibilityContext.Provider;
