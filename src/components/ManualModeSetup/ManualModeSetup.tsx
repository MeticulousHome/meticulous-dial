import { useEffect, useMemo, useRef, useState } from 'react';
import { styled } from 'styled-components';

import { api } from '../../api/api';
import { loadProfileData, saveProfile, startProfile } from '../../api/profile';
import {
  MANUAL_MODE_PROFILE_ID,
  MANUAL_WEIGHT_DISABLED,
  ManualControl
} from '../../constants/manualMode.ts';
import { useDimScreen } from '../../hooks/useDimScreen';
import { useHandleGestures } from '../../hooks/useHandleGestures';
import { useProfileContext } from '../../context/ProfileContext';
import Styled, { VIEWPORT_HEIGHT } from '../../styles/utils/mixins';
import { calculateOptionPosition } from '../../styles/utils/calculateOptionPosition';
import { LoadingScreen } from '../LoadingScreen/LoadingScreen';
import { Gauge } from '../SettingNumerical/Gauge';
import {
  setBubbleDisplay,
  setScreen
} from '../store/features/screens/screens-slice';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import {
  applyManualSetup,
  defaultManualProfile,
  isWeightDisabled,
  nextTemperature,
  nextWeight,
  outputStepHint,
  startControlOf,
  MANUAL_TEMPERATURE_MAX,
  MANUAL_WEIGHT_MAX,
  ManualProfile
} from './manualSetup.ts';

// Value gotten from ComplexProfileConverter.head_template on 'prepare' stage,
// the same rule the profile settings screen starts a shot with.
const PISTON_ON_PURGE_POSITION = 73;

type SetupStep = 'temperature' | 'output' | 'start';

type StartOption = ManualControl | 'abort';

const startOptions: { key: StartOption; label: string }[] = [
  { key: 'pressure', label: 'Start on pressure' },
  { key: 'flow', label: 'Start on flow' },
  { key: 'abort', label: 'Abort' }
];

// Anchored by its bottom edge so the lowest line keeps sitting where the single
// legend used to, and a second line stacks above it rather than pushing it down
// into the curve of the round display.
const Legend = styled.div`
  position: absolute;
  bottom: 74px;
  left: 0;
  right: 0;
  z-index: 60;
  display: flex;
  flex-direction: column;
  gap: 7px;
  text-align: center;
  font-family: 'ABC Diatype';
  font-size: 15px;
  letter-spacing: 1.125px;
  color: #808080;
`;

const OffValue = styled.div`
  position: absolute;
  top: 0;
  right: 0;
  left: 0;
  bottom: 0;
  z-index: 50;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: 'ABC Diatype Mono';
  font-size: 140px;
  line-height: 96px;
  color: #f5c444;
`;

/**
 * Three answers, then the shot starts.
 *
 * The machine keeps one seeded manual profile, so this screen edits that
 * document in place rather than creating a profile: it reads the saved
 * temperature, final weight and stage order back into the gauges, writes the
 * three answers, saves, loads and starts. The final weight can be turned off
 * entirely - a manual shot usually ends on the long press - which is why the
 * output step swaps the gauge for `Off` instead of showing an unreachable
 * 2000 g.
 */
export const ManualModeSetup = (): JSX.Element => {
  const dispatch = useAppDispatch();
  const bubbleDisplay = useAppSelector((state) => state.screen.bubbleDisplay);
  const previousScreen = useAppSelector((state) => state.screen.prev);
  const pistonPosition = useAppSelector(
    (state) => state.stats.sensorData.m_pos
  );
  const { setProfileStarting } = useProfileContext();

  const [profile, setProfile] = useState<ManualProfile | null>(null);
  const [step, setStep] = useState<SetupStep>('temperature');
  const [temperature, setTemperature] = useState(0);
  const [finalWeight, setFinalWeight] = useState(0);
  const [start, setStart] = useState<StartOption>('pressure');
  const previousEnabledWeight = useRef<number | null>(null);
  const starting = useRef(false);
  const requiresPurge = useRef(false);

  useDimScreen();

  useEffect(() => {
    requiresPurge.current =
      !!pistonPosition && pistonPosition < PISTON_ON_PURGE_POSITION;
  }, [pistonPosition]);

  // The profile is the machine's, so the gauges only mean anything once it has
  // been read back. A machine that has never seen manual mode answers 404, and
  // the seeded document stands in until the first save writes it.
  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      let loaded = defaultManualProfile();
      try {
        const { data } = await api.getProfile(MANUAL_MODE_PROFILE_ID);
        if (data && !('error' in data)) {
          loaded = data as ManualProfile;
        }
      } catch (error) {
        console.error('Could not read the manual profile:', error);
      }

      if (cancelled) return;

      setProfile(loaded);
      setTemperature(loaded.temperature);
      setFinalWeight(loaded.final_weight);
      previousEnabledWeight.current = isWeightDisabled(loaded.final_weight)
        ? null
        : loaded.final_weight;
      setStart(startControlOf(loaded));
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  // The screen is reached from the quick-settings Experimental menu, so leaving
  // it - aborting, double-clicking or failing to start - reopens that menu
  // rather than the profile list.
  const backToMenu = () => {
    dispatch(setScreen(previousScreen || 'profileHome'));
    dispatch(
      setBubbleDisplay({ visible: true, component: 'experimentalSettings' })
    );
  };

  const confirm = async () => {
    if (starting.current || !profile || start === 'abort') return;
    starting.current = true;

    const applied = applyManualSetup(profile, {
      temperature,
      finalWeight,
      start
    });

    const saved = await saveProfile(applied);
    if (!saved || 'error' in saved) {
      console.error('Failed saving the manual profile');
      starting.current = false;
      backToMenu();
      return;
    }

    const loaded = await loadProfileData(applied);
    if (typeof loaded === 'object' && loaded && 'name' in loaded) {
      setProfileStarting(true);
      const response = await startProfile();
      if (response && !('error' in response)) {
        dispatch(setScreen(requiresPurge.current ? 'manual-purge' : 'heating'));
        return;
      }
      setProfileStarting(false);
      console.error('Failed starting the manual profile');
    } else {
      console.error('Failed loading the manual profile');
    }

    starting.current = false;
    backToMenu();
  };

  const turn = (direction: 'left' | 'right') => {
    if (step === 'temperature') {
      setTemperature((current) => nextTemperature(current, direction));
      return;
    }
    if (step === 'output') {
      setFinalWeight((current) => {
        const next = nextWeight(
          current,
          previousEnabledWeight.current,
          direction
        );
        previousEnabledWeight.current = next;
        return next;
      });
      return;
    }
    setStart((current) => {
      const index = startOptions.findIndex((option) => option.key === current);
      const next = direction === 'left' ? index - 1 : index + 1;
      return startOptions[Math.min(Math.max(next, 0), startOptions.length - 1)]
        .key;
    });
  };

  useHandleGestures(
    {
      left() {
        turn('left');
      },
      right() {
        turn('right');
      },
      longEncoder() {
        if (step !== 'output') return;
        setFinalWeight((current) => {
          if (!isWeightDisabled(current)) {
            previousEnabledWeight.current = current;
          }
          return MANUAL_WEIGHT_DISABLED;
        });
      },
      // `click` is the short push the machine reports on release. `pressDown`
      // fires the moment the knob goes down, before a long press is known to
      // be one, so accepting on it turned every long press on the weight step
      // into an accept and the `Off` gesture never reached the gauge.
      click() {
        if (step === 'temperature') {
          setStep('output');
          return;
        }
        if (step === 'output') {
          setStep('start');
          return;
        }
        if (start === 'abort') {
          backToMenu();
          return;
        }
        void confirm();
      },
      doubleClick() {
        backToMenu();
      }
    },
    bubbleDisplay.interceptsGesture || !profile
  );

  const activeStartIndex = startOptions.findIndex(
    (option) => option.key === start
  );

  const optionPositionOuter = useMemo(
    () =>
      calculateOptionPosition({
        activeOptionIdx: activeStartIndex,
        settings: startOptions
      }),
    [activeStartIndex]
  );

  const optionPositionInner = useMemo(
    () =>
      calculateOptionPosition({
        activeOptionIdx: activeStartIndex,
        adjustmentFn: (position) => position - VIEWPORT_HEIGHT / 2,
        settings: startOptions
      }),
    [activeStartIndex]
  );

  if (!profile) {
    return <LoadingScreen />;
  }

  if (step === 'temperature') {
    return (
      <>
        <Gauge
          unit="celcius"
          maxValue={MANUAL_TEMPERATURE_MAX}
          precision={1}
          value={temperature}
        />
        <Legend>
          <span>Click to continue</span>
        </Legend>
      </>
    );
  }

  if (step === 'output') {
    return (
      <>
        {isWeightDisabled(finalWeight) ? (
          <OffValue>Off</OffValue>
        ) : (
          <Gauge
            unit="gram"
            maxValue={MANUAL_WEIGHT_MAX}
            precision={1}
            value={finalWeight}
          />
        )}
        <Legend>
          <span>{outputStepHint(finalWeight)}</span>
          <span>Click to continue</span>
        </Legend>
      </>
    );
  }

  return (
    <Styled.SettingsContainer>
      <Styled.Viewport>
        <Styled.OptionsContainer $translateY={optionPositionOuter}>
          {startOptions.map((option) => (
            <Styled.Option key={option.key}>
              <span>{option.label}</span>
            </Styled.Option>
          ))}
        </Styled.OptionsContainer>
        <Styled.ActiveIndicator>
          <Styled.OptionsContainer
            $translateY={optionPositionInner}
            $isInner={true}
          >
            {startOptions.map((option) => (
              <Styled.Option key={option.key}>
                <span>{option.label}</span>
              </Styled.Option>
            ))}
          </Styled.OptionsContainer>
        </Styled.ActiveIndicator>
      </Styled.Viewport>
    </Styled.SettingsContainer>
  );
};
