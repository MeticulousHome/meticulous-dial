import { createContext, useContext, useState, ReactNode } from 'react';
type PistonPosContextType = {
  PistonPos: number;
  setPistonPos: React.Dispatch<React.SetStateAction<number>>;
};

const PistonPosContext = createContext<PistonPosContextType | undefined>(
  undefined
);

export const usePistonPosContext = () => {
  const context = useContext(PistonPosContext);
  if (!context) {
    throw new Error(
      'usePistonPosContext must be used within a PistonPosProvider'
    );
  }
  return context;
};

export const PistonPosProvider = ({ children }: { children: ReactNode }) => {
  const [PistonPos, setPistonPos] = useState<number | undefined>(undefined);
  return (
    <PistonPosContext.Provider value={{ PistonPos, setPistonPos }}>
      {children}
    </PistonPosContext.Provider>
  );
};
