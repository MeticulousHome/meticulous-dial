import { useEffect, useRef, useState } from 'react';
import { loadProfileData } from '../../api/profile';
import { api } from '../../api/api';
import { useHandleGestures } from '../../hooks/useHandleGestures';
import { PurgePiston } from '../PurgePiston/PurgePiston';
import {
  finishCleaning,
  setCleaningStage
} from '../store/features/screens/screens-slice';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import groupWithCup from '../../assets/cleaning-group-cup.png';
import groupWithoutCup from '../../assets/cleaning-group.png';
import { CLEANING_PROFILE } from './cleaningProfile';
import './cleaning.css';

const responseSucceeded = (response: unknown) =>
  typeof response === 'object' && response !== null && !('error' in response);

const GroupIllustration = ({ cup }: { cup: boolean }) => (
  <img
    className="cleaning-group-illustration"
    src={cup ? groupWithCup : groupWithoutCup}
    alt={
      cup
        ? 'Group head with a cup centered underneath'
        : 'Group head ready to be wiped underneath'
    }
    draggable={false}
  />
);

export const CleaningScreen = () => {
  const dispatch = useAppDispatch();
  const stage = useAppSelector((state) => state.screen.cleaningStage);
  const machineName = useAppSelector((state) => state.stats.name);
  const temperature =
    useAppSelector((state) => Math.round(state.stats.sensors.t)) || 0;
  const bubbleInterceptsGesture = useAppSelector(
    (state) => state.screen.bubbleDisplay.interceptsGesture
  );
  const [starting, setStarting] = useState(false);

  const sawRaise = useRef(false);
  const sawPurge = useRef(false);
  const sawFinished = useRef(false);

  useEffect(() => {
    if (stage === 'setup') {
      sawRaise.current = false;
      sawPurge.current = false;
      sawFinished.current = false;
    }
  }, [stage]);

  useEffect(() => {
    if (machineName === 'cleaning failed') {
      dispatch(setCleaningStage('error'));
      return;
    }

    if (stage === 'heating' && machineName === 'click to start') {
      dispatch(setCleaningStage('ready'));
      return;
    }

    if ((stage === 'ready' || stage === 'raising') && machineName === 'home') {
      sawRaise.current = true;
      dispatch(setCleaningStage('raising'));
      return;
    }

    if (stage === 'raising' && machineName === 'purge') {
      sawPurge.current = true;
      dispatch(setCleaningStage('purging'));
      return;
    }

    if (stage === 'purging' && machineName === 'finished') {
      sawFinished.current = true;
      return;
    }

    if (
      stage === 'purging' &&
      sawPurge.current &&
      sawFinished.current &&
      machineName === 'idle'
    ) {
      dispatch(setCleaningStage('wipe'));
      return;
    }

    if (
      ((stage === 'raising' && sawRaise.current) ||
        (stage === 'purging' && sawPurge.current)) &&
      machineName === 'idle'
    ) {
      dispatch(setCleaningStage('error'));
    }
  }, [dispatch, machineName, stage]);

  useEffect(() => {
    if (stage !== 'heating' || machineName !== 'idle') return;

    const unsupportedFirmwareTimer = window.setTimeout(() => {
      dispatch(setCleaningStage('error'));
    }, 5000);

    return () => window.clearTimeout(unsupportedFirmwareTimer);
  }, [dispatch, machineName, stage]);

  const startHeating = async () => {
    if (starting) return;
    setStarting(true);
    dispatch(setCleaningStage('heating'));

    const loaded = await loadProfileData(CLEANING_PROFILE);
    if (!responseSucceeded(loaded)) {
      dispatch(setCleaningStage('error'));
      setStarting(false);
      return;
    }

    setStarting(false);
  };

  const startFlush = async () => {
    if (starting) return;
    setStarting(true);
    try {
      const { data } = await api.executeAction('continue');
      if (!responseSucceeded(data)) {
        dispatch(setCleaningStage('error'));
        return;
      }
      dispatch(setCleaningStage('raising'));
    } catch (error) {
      console.error('Failed to continue the cleaning profile:', error);
      dispatch(setCleaningStage('error'));
    } finally {
      setStarting(false);
    }
  };

  useHandleGestures(
    {
      click() {
        if (stage === 'setup') {
          void startHeating();
        } else if (stage === 'ready') {
          void startFlush();
        } else if (stage === 'wipe') {
          dispatch(finishCleaning());
        } else if (stage === 'error') {
          dispatch(finishCleaning());
        }
      }
    },
    bubbleInterceptsGesture || starting
  );

  if (stage === 'raising' || stage === 'purging') {
    return (
      <div className="cleaning-motion-screen">
        <PurgePiston exitOnMissingPosition={false} />
      </div>
    );
  }

  if (stage === 'wipe') {
    return (
      <div className="cleaning-instruction-screen">
        <GroupIllustration cup={false} />
        <div className="cleaning-cloth" aria-hidden="true">
          <span />
        </div>
        <div className="cleaning-copy cleaning-copy-two-lines">
          <strong>DRY THE SHOWER SCREEN</strong>
          <span>PUSH WHEN DONE</span>
        </div>
      </div>
    );
  }

  if (stage === 'error') {
    return (
      <div className="cleaning-instruction-screen">
        <GroupIllustration cup={false} />
        <div className="cleaning-copy cleaning-copy-two-lines">
          <strong>CLEANING STOPPED</strong>
          <span>PUSH TO EXIT</span>
        </div>
      </div>
    );
  }

  const ready = stage === 'ready';
  return (
    <div className="cleaning-instruction-screen">
      <GroupIllustration cup />
      {stage === 'setup' ? (
        <div className="cleaning-copy">
          <strong>ADD WATER AND PLACE CUP</strong>
        </div>
      ) : ready ? (
        <div className="cleaning-copy">
          <strong>PUSH TO FLUSH</strong>
        </div>
      ) : (
        <div className="cleaning-copy cleaning-heating-status">
          <span>HEATING</span>
          <strong>
            {temperature}
            <sup>°C</sup>
          </strong>
        </div>
      )}
    </div>
  );
};
