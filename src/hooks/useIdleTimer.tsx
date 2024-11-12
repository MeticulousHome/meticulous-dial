import React, {
  createContext,
  useState,
  useEffect,
  useContext,
  ReactNode,
  useRef,
  useCallback
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
const DEFAULT_TIMEOUT = 5 * 60 * 1000;

export const IdleTimerProvider: React.FC<IdleTimerProviderProps> = ({
  children
}): JSX.Element => {
  const [idleTime, setIdleTime] = useState(DEFAULT_TIMEOUT);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isIdle, setIsIdle] = useState(false);
  const startTimer = useCallback(() => {
    timeoutRef.current = setTimeout(() => {
      setIsIdle(true);
    }, idleTime);
  }, []);

  const resetTimer = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setIsIdle(false);
    startTimer();
  }, []);

  useEffect(() => {
    startTimer();
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [idleTime]);

  return (
    <TimerContext.Provider
      value={{ resetTimer, setTimer: setIdleTime, isIdle }}
    >
      {children}
    </TimerContext.Provider>
  );
};
