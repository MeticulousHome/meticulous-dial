import React, {
  createContext,
  useState,
  useEffect,
  useContext,
  ReactNode,
  useRef
} from 'react';

interface TimerContextType {
  resetTimer: () => void;
  setTimer: (timeout: number) => void;
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
  const time = useRef(0);
  const [isIdle, setIsIdle] = useState(false);

  const resetTimer = () => {
    time.current = 0;
    setIsIdle(false);
  };

  const setTimer = (timeout: number) => {
    setIdleTime(timeout);
  };

  useEffect(() => {
    const intervalId = setInterval(() => {
      time.current += 1;
    }, 1000);
    return () => clearInterval(intervalId);
  }, []);

  useEffect(() => {
    if (!time.current) {
      return;
    }
    if (time.current >= idleTime) {
      setIsIdle(true);
    }
  }, [time.current, idleTime]);

  return (
    <TimerContext.Provider value={{ resetTimer, setTimer, isIdle }}>
      {children}
    </TimerContext.Provider>
  );
};
