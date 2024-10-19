import React, {
  createContext,
  useState,
  useEffect,
  useContext,
  useCallback,
  ReactNode
} from 'react';

interface TimerContextType {
  resetTimer: () => void;
  setTimer: () => void;
  isIdle: boolean;
}

const TimerContext = createContext<TimerContextType | undefined>(undefined);

export const useIdleTimer = (): TimerContextType => {
  const context = useContext(TimerContext);
  if (!context) {
    throw new Error('useTimer must be used within a TimerProvider');
  }
  return context;
};

type IdleTimerProviderProps = {
  children?: ReactNode;
};

// 5 minutes default timeout
const DEFAULT_TIMEOUT = 5 * 60;

export const IdleTimerProvider: React.FC<IdleTimerProviderProps> = ({
  children
}): JSX.Element => {
  const [idleTime, setIdleTime] = useState(DEFAULT_TIMEOUT);
  const [time, setTime] = useState(0);
  const [isIdle, setIsIdle] = useState(false);

  const resetTimer = useCallback(() => {
    setTime(0);
    setIsIdle(false);
  }, []);

  const setTimer = useCallback(() => {
    setIdleTime(0);
    setIsIdle(false);
  }, []);

  useEffect(() => {
    const intervalId = setInterval(() => {
      setTime((prevTime) => prevTime + 1);
    }, 1000);

    if (time >= idleTime) {
      setIsIdle(true);
    }

    return () => clearInterval(intervalId);
  }, [time, idleTime, resetTimer]);

  return (
    <TimerContext.Provider value={{ resetTimer, setTimer, isIdle }}>
      {children}
    </TimerContext.Provider>
  );
};
