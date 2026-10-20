import {
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
  isIdleNow: () => boolean;
  forceIdle: () => void;
  forceScreenOff: () => void;
  screenOffRequested: boolean;
  forceBubbleReopen: boolean;
  setForceBubbleReopen: (value: boolean) => void;
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
  // Input events can arrive in one browser turn, before React renders the
  // transition. The socket boundary needs the immediately updated state.
  const idleRef = useRef(false);
  const isIdleNow = useCallback(() => idleRef.current, []);
  const [screenOffRequested, setScreenOffRequested] = useState(false);
  const [forceBubbleReopen, setForceBubbleReopen] = useState(false);

  const startTimer = useCallback(() => {
    timeoutRef.current = setTimeout(() => {
      idleRef.current = true;
      setIsIdle(true);
    }, idleTime);
  }, [idleTime]);

  const resetTimer = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    idleRef.current = false;
    setIsIdle(false);
    setScreenOffRequested(false);
    startTimer();
  }, [startTimer]);

  useEffect(() => {
    startTimer();
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [idleTime]);

  const forceIdle = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    idleRef.current = true;
    setScreenOffRequested(false);
    setIsIdle(true);
  }, []);

  const forceScreenOff = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    idleRef.current = true;
    setScreenOffRequested(true);
    setIsIdle(true);
  }, []);

  return (
    <TimerContext.Provider
      value={{
        resetTimer,
        setTimer: setIdleTime,
        isIdle,
        isIdleNow,
        forceIdle,
        forceScreenOff,
        screenOffRequested,
        forceBubbleReopen,
        setForceBubbleReopen
      }}
    >
      {children}
    </TimerContext.Provider>
  );
};
