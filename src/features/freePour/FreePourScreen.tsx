import { useEffect, useMemo, useRef, useState } from 'react';
import { useHandleGestures } from '../../hooks/useHandleGestures';
import { useIdleTimer } from '../../hooks/useIdleTimer';
import { Gauge } from '../../components/SettingNumerical/Gauge';
import { useAppDispatch, useAppSelector } from '../../components/store/hooks';
import { useSocket } from '../../components/store/SocketManager';
import { setScreen } from '../../components/store/features/screens/screens-slice';
import { colorDataBlueLight } from '../../constants/colors';
import { clamp, formatBrewTime, roundTo } from './format';
import { DetectorSample, PourDetector } from './pourDetector';
import { saveFreePourSession } from './storage';
import {
  FREE_POUR_SCHEMA_VERSION,
  FreePourCompletion,
  FreePourPour,
  FreePourSample,
  FreePourSession
} from './types';
import './free-pour.css';

type Stage =
  | 'server'
  | 'dose'
  | 'recipe'
  | 'ready'
  | 'pouring'
  | 'waiting'
  | 'finish-requested'
  | 'measuring'
  | 'replace-server'
  | 'result';

const SAMPLE_INTERVAL_MS = 200;
const MAX_POURS = 5;

const stepForStage = (stage: Stage) => {
  if (stage === 'server') return 1;
  if (stage === 'dose') return 2;
  if (stage === 'recipe') return 3;
  if (stage === 'ready' || stage === 'pouring') return 4;
  if (stage === 'waiting') return 5;
  if (stage === 'finish-requested' || stage === 'measuring') return 6;
  return 7;
};

const useStableWeight = (weight: number, resetKey: Stage) => {
  const latestWeight = useRef(weight);
  const readings = useRef<{ time: number; weight: number }[]>([]);
  const [stable, setStable] = useState(false);
  latestWeight.current = weight;

  useEffect(() => {
    readings.current = [];
    setStable(false);
  }, [resetKey]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      const now = performance.now();
      readings.current.push({ time: now, weight: latestWeight.current });
      while (readings.current[0]?.time < now - 900) readings.current.shift();
      const values = readings.current.map((reading) => reading.weight);
      const range = values.length
        ? Math.max(...values) - Math.min(...values)
        : Infinity;
      const duration = now - (readings.current[0]?.time ?? now);
      const nextStable = duration >= 700 && range <= 0.6;
      setStable((previous) =>
        previous === nextStable ? previous : nextStable
      );
    }, 100);
    return () => window.clearInterval(interval);
  }, []);

  return stable;
};

const FlowMeter = ({ flow }: { flow: number }) => {
  const displayedFlow = clamp(flow, 0, 10);
  return (
    <div className="free-pour-flow-meter">
      <div className="free-pour-flow-title">
        FLOW · <span>{Math.round(displayedFlow)} g/s</span>
      </div>
      <div className="free-pour-flow-segments">
        {Array.from({ length: 10 }, (_, index) => (
          <span className="free-pour-flow-segment" key={index}>
            <i
              style={{
                width: `${clamp(displayedFlow - index, 0, 1) * 100}%`,
                backgroundColor: colorDataBlueLight
              }}
            />
          </span>
        ))}
      </div>
      <div className="free-pour-flow-axis">
        {Array.from({ length: 11 }, (_, index) => (
          <span key={index}>{index}</span>
        ))}
      </div>
    </div>
  );
};

const PourRail = ({
  pours,
  activePour,
  waiting
}: {
  pours: FreePourPour[];
  activePour: { number: number; startTimeMs: number } | null;
  waiting: boolean;
}) => {
  const maxedOut = !activePour && pours.length >= MAX_POURS;
  const completed = maxedOut ? pours.slice(-5) : pours.slice(-4);
  const showOpenCenter = waiting && pours.length < MAX_POURS;
  const centerNumber =
    activePour?.number ?? Math.min(pours.length + 1, MAX_POURS);
  return (
    <div className="free-pour-rail" aria-label={`Pour ${centerNumber}`}>
      <div
        className={`free-pour-rail-line ${
          maxedOut ? 'free-pour-rail-line--complete' : ''
        }`}
      />
      {completed.map((pour, index) => {
        const offset = maxedOut
          ? (index - Math.floor(completed.length / 2)) * 52
          : -(completed.length - index) * 52;
        return (
          <div
            className="free-pour-rail-point free-pour-rail-point--past"
            key={pour.number}
            style={{ transform: `translateX(${offset}px)` }}
          >
            <span className="free-pour-dot free-pour-dot--past" />
            <small>{formatBrewTime(pour.startTimeMs)}</small>
          </div>
        );
      })}
      {activePour && (
        <div className="free-pour-rail-point">
          <span className="free-pour-dot free-pour-dot--active" />
          <small>{formatBrewTime(activePour.startTimeMs)}</small>
        </div>
      )}
      {showOpenCenter && (
        <div className="free-pour-rail-point">
          <span className="free-pour-dot" />
        </div>
      )}
    </div>
  );
};

export const FreePourScreen = () => {
  const dispatch = useAppDispatch();
  const socket = useSocket();
  const { resetTimer } = useIdleTimer();
  const weight = useAppSelector((state) => state.stats.sensors.w || 0);
  const gravimetricFlow = useAppSelector((state) => state.stats.sensors.g || 0);
  const [stage, setStage] = useState<Stage>('server');
  const [doseG, setDoseG] = useState(15);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [pours, setPours] = useState<FreePourPour[]>([]);
  const [activePourView, setActivePourView] = useState<{
    number: number;
    startTimeMs: number;
  } | null>(null);
  const [result, setResult] = useState<FreePourSession | null>(null);
  const stable = useStableWeight(weight, stage);
  const serverReady = stable && weight >= 20;
  const setupReady = stable && weight >= 5;

  const stageRef = useRef(stage);
  const weightRef = useRef(weight);
  const flowRef = useRef(gravimetricFlow);
  const detector = useRef(new PourDetector());
  const serverWeight = useRef(0);
  const setupWeight = useRef(0);
  const startedAtIso = useRef('');
  const brewStartTime = useRef<number | null>(null);
  const elapsedMsRef = useRef(0);
  const lastStoredSampleTime = useRef(0);
  const peakWaterWeight = useRef(0);
  const samples = useRef<FreePourSample[]>([]);
  const completedPours = useRef<FreePourPour[]>([]);
  const activePour = useRef<{
    number: number;
    startTimeMs: number;
    startWeightG: number;
    peakWeightG: number;
    peakFlowGps: number;
  } | null>(null);
  const completion = useRef<FreePourCompletion>('brewer_removed');
  const finalizing = useRef(false);

  stageRef.current = stage;
  weightRef.current = weight;
  flowRef.current = gravimetricFlow;

  const updateStage = (next: Stage) => {
    stageRef.current = next;
    setStage(next);
  };

  const finishActivePour = (timeMs: number, endWeightG: number) => {
    const current = activePour.current;
    if (!current || brewStartTime.current === null) return;
    const endTimeMs = Math.max(
      current.startTimeMs,
      timeMs - brewStartTime.current
    );
    const finalWeight = Math.max(
      current.startWeightG,
      endWeightG,
      current.peakWeightG
    );
    const waterG = Math.max(0, finalWeight - current.startWeightG);
    const durationSeconds = Math.max(
      0.1,
      (endTimeMs - current.startTimeMs) / 1000
    );
    const finished: FreePourPour = {
      number: current.number,
      startTimeMs: Math.round(current.startTimeMs),
      endTimeMs: Math.round(endTimeMs),
      startWeightG: roundTo(current.startWeightG),
      endWeightG: roundTo(finalWeight),
      waterG: roundTo(waterG),
      averageFlowGps: roundTo(waterG / durationSeconds),
      peakFlowGps: roundTo(current.peakFlowGps)
    };
    completedPours.current = [...completedPours.current, finished];
    setPours(completedPours.current);
    activePour.current = null;
    setActivePourView(null);
  };

  const createSession = (beverageG: number | null) => {
    const waterPouredG = Math.max(0, roundTo(peakWaterWeight.current));
    const measuredBeverage =
      beverageG === null ? null : Math.max(0, roundTo(beverageG));
    const retainedG =
      measuredBeverage === null
        ? null
        : Math.max(0, roundTo(waterPouredG - measuredBeverage));
    const now = new Date();
    const session: FreePourSession = {
      schemaVersion: FREE_POUR_SCHEMA_VERSION,
      id:
        globalThis.crypto?.randomUUID?.() ??
        `free-pour-${now.getTime()}-${Math.round(Math.random() * 100000)}`,
      brewType: 'pour_over',
      mode: 'free_pour',
      name: 'Free Pour',
      source: 'dial',
      startedAt: startedAtIso.current || now.toISOString(),
      completedAt: now.toISOString(),
      recipe: {
        profileId: null,
        profileName: 'Free Pour',
        doseG,
        targetWaterG: null,
        pourTargets: []
      },
      measurements: {
        emptyServerG: roundTo(serverWeight.current),
        setupG: roundTo(setupWeight.current),
        waterPouredG,
        beverageG: measuredBeverage,
        retainedG,
        durationMs: Math.round(elapsedMsRef.current),
        status: measuredBeverage === null ? 'skipped' : 'measured'
      },
      pours: completedPours.current,
      samples: samples.current,
      completion: completion.current,
      sync: { status: 'pending', attempts: 0 }
    };
    setResult(session);
    updateStage('result');
    saveFreePourSession(session).catch((error) => {
      console.error('Failed to save Free Pour session', error);
    });
  };

  const beginMeasurement = (timeMs: number) => {
    if (finalizing.current) return;
    finalizing.current = true;
    if (activePour.current) finishActivePour(timeMs, peakWaterWeight.current);
    detector.current.reset();
    updateStage('measuring');
  };

  useEffect(() => {
    const keepAwake = window.setInterval(resetTimer, 60_000);
    return () => window.clearInterval(keepAwake);
  }, [resetTimer]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      const now = performance.now();
      const currentStage = stageRef.current;
      const currentWeight = weightRef.current;
      const currentFlow = Math.max(0, flowRef.current);

      if (
        brewStartTime.current !== null &&
        (currentStage === 'pouring' ||
          currentStage === 'waiting' ||
          currentStage === 'finish-requested')
      ) {
        const removalThreshold = Math.max(28, setupWeight.current * 0.18);
        if (
          peakWaterWeight.current >= 20 &&
          currentWeight <= peakWaterWeight.current - removalThreshold
        ) {
          beginMeasurement(now);
          return;
        }
      }

      const timingActive =
        currentStage === 'pouring' ||
        currentStage === 'waiting' ||
        currentStage === 'finish-requested';
      if (brewStartTime.current !== null && timingActive) {
        const nextElapsed = now - brewStartTime.current;
        elapsedMsRef.current = nextElapsed;
        setElapsedMs(nextElapsed);
        peakWaterWeight.current = Math.max(
          peakWaterWeight.current,
          currentWeight
        );
        if (activePour.current) {
          activePour.current.peakWeightG = Math.max(
            activePour.current.peakWeightG,
            currentWeight
          );
          activePour.current.peakFlowGps = Math.max(
            activePour.current.peakFlowGps,
            currentFlow
          );
        }
        if (now - lastStoredSampleTime.current >= SAMPLE_INTERVAL_MS) {
          lastStoredSampleTime.current = now;
          samples.current.push({
            t: Math.round(nextElapsed),
            w: roundTo(Math.max(0, currentWeight)),
            f: roundTo(currentFlow),
            p: activePour.current?.number ?? 0
          });
        }
      }

      const brewingStage =
        currentStage === 'ready' ||
        currentStage === 'pouring' ||
        currentStage === 'waiting';
      if (brewingStage) {
        const detectorSample: DetectorSample = {
          timeMs: now,
          weightG: currentWeight,
          flowGps: currentFlow
        };
        const event = detector.current.process(detectorSample);
        if (event?.type === 'pour-start') {
          if (brewStartTime.current === null) {
            brewStartTime.current = event.sample.timeMs;
            startedAtIso.current = new Date(
              Date.now() - (now - event.sample.timeMs)
            ).toISOString();
            peakWaterWeight.current = Math.max(0, event.sample.weightG);
          }
          const previousFifthPour =
            completedPours.current.length >= MAX_POURS
              ? completedPours.current[MAX_POURS - 1]
              : null;
          if (previousFifthPour) {
            completedPours.current = completedPours.current.slice(0, -1);
            setPours(completedPours.current);
          }
          const startTimeMs = previousFifthPour
            ? previousFifthPour.startTimeMs
            : event.sample.timeMs - brewStartTime.current;
          const nextPour = previousFifthPour
            ? {
                number: MAX_POURS,
                startTimeMs,
                startWeightG: previousFifthPour.startWeightG,
                peakWeightG: Math.max(
                  previousFifthPour.endWeightG,
                  event.sample.weightG
                ),
                peakFlowGps: Math.max(
                  previousFifthPour.peakFlowGps,
                  event.sample.flowGps
                )
              }
            : {
                number: completedPours.current.length + 1,
                startTimeMs,
                startWeightG: Math.max(0, event.sample.weightG),
                peakWeightG: Math.max(0, event.sample.weightG),
                peakFlowGps: Math.max(0, event.sample.flowGps)
              };
          activePour.current = nextPour;
          setActivePourView({ number: nextPour.number, startTimeMs });
          updateStage('pouring');
        } else if (event?.type === 'pour-end' && activePour.current) {
          finishActivePour(event.sample.timeMs, event.sample.weightG);
          updateStage('waiting');
        }
      }
    }, 100);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!stable || stage !== 'measuring') return;
    const candidateBeverage = weight + setupWeight.current;
    const water = peakWaterWeight.current;
    const plausible =
      candidateBeverage >= Math.max(8, water * 0.2) &&
      candidateBeverage <= water + 8;
    if (plausible) {
      createSession(candidateBeverage);
    } else if (candidateBeverage <= Math.max(5, water * 0.08)) {
      finalizing.current = false;
      updateStage('replace-server');
    } else if (candidateBeverage > water + 8) {
      // A transient bump can resemble a lift. Return to the live state once
      // the full setup is stable on the scale again.
      finalizing.current = false;
      updateStage('waiting');
    }
  }, [stable, stage, weight]);

  useEffect(() => {
    if (!stable || stage !== 'replace-server') return;
    const candidateBeverage = weight + setupWeight.current;
    const water = peakWaterWeight.current;
    if (
      candidateBeverage >= Math.max(8, water * 0.2) &&
      candidateBeverage <= water + 8
    ) {
      createSession(candidateBeverage);
    }
  }, [stable, stage, weight]);

  useHandleGestures(
    {
      left() {
        if (stageRef.current === 'dose')
          setDoseG((value) => clamp(value - 1, 5, 40));
      },
      right() {
        if (stageRef.current === 'dose')
          setDoseG((value) => clamp(value + 1, 5, 40));
      },
      click() {
        const currentStage = stageRef.current;
        if (currentStage === 'server' && serverReady) {
          serverWeight.current = weightRef.current;
          socket.emit('action', 'tare');
          updateStage('dose');
          return;
        }
        if (currentStage === 'dose' && setupReady) {
          setupWeight.current = weightRef.current;
          socket.emit('action', 'tare');
          window.setTimeout(() => updateStage('recipe'), 350);
          return;
        }
        if (currentStage === 'recipe') {
          updateStage('ready');
          return;
        }
        if (currentStage === 'pouring' || currentStage === 'waiting') {
          completion.current = 'dial_fallback';
          updateStage('finish-requested');
          return;
        }
        if (currentStage === 'replace-server') {
          createSession(null);
          return;
        }
        if (currentStage === 'result') {
          dispatch(setScreen('freePourHistory'));
        }
      },
      pressDown() {
        if (stageRef.current === 'ready') return;
      },
      context() {
        dispatch(setScreen('profileHome'));
      }
    },
    false
  );

  const step = stepForStage(stage);
  const liveFlow = Math.max(0, gravimetricFlow);
  const roundedWeight = Math.max(0, Math.round(weight));
  const liveState =
    stage === 'ready' || stage === 'pouring' || stage === 'waiting';
  const statusLabel =
    stage === 'ready'
      ? 'READY'
      : stage === 'pouring'
        ? `POUR ${activePourView?.number ?? 1}`
        : stage === 'waiting'
          ? pours.length >= MAX_POURS
            ? 'DRAWDOWN'
            : 'WAITING'
          : '';
  const railPours = useMemo(() => pours, [pours]);

  if (stage === 'dose') {
    return (
      <div className="free-pour-screen free-pour-dose-screen">
        <Gauge
          value={doseG}
          minValue={5}
          maxValue={40}
          precision={0}
          unit="gram"
        />
        <div className="free-pour-step">2 OF 7</div>
        <div className="free-pour-dose-title">SET COFFEE DOSE</div>
        <div
          className={`free-pour-dose-action ${
            setupReady ? '' : 'free-pour-dose-action--disabled'
          }`}
        >
          <span>PRESS DIAL TO SAVE</span>
          <strong>DOSE + TARE</strong>
        </div>
      </div>
    );
  }

  if (stage === 'server') {
    return (
      <div className="free-pour-screen free-pour-setup-screen">
        <div className="free-pour-step">1 OF 7</div>
        <div className="free-pour-kicker">EMPTY SERVER</div>
        <div className="free-pour-setup-weight">{Math.round(weight)}g</div>
        <div className="free-pour-stability">
          {weight < 20
            ? 'PLACE EMPTY SERVER'
            : serverReady
              ? 'WEIGHT STABLE'
              : 'WAITING FOR STABLE WEIGHT'}
        </div>
        <div className="free-pour-setup-action">PRESS DIAL TO SAVE + TARE</div>
      </div>
    );
  }

  if (stage === 'recipe') {
    return (
      <div className="free-pour-screen free-pour-recipe-screen">
        <div className="free-pour-step">3 OF 7</div>
        <div className="free-pour-name">FREE POUR</div>
        <div className="free-pour-recipe-dose">{doseG}g</div>
        <div className="free-pour-recipe-label">DOSE</div>
        <div className="free-pour-recipe-ready">READY TO BREW</div>
        <div className="free-pour-recipe-action">PRESS DIAL TO CONTINUE</div>
      </div>
    );
  }

  if (liveState) {
    return (
      <div className="free-pour-screen free-pour-live-screen">
        <div className="free-pour-step">{step} OF 7</div>
        <div className="free-pour-name">FREE POUR</div>
        <div className="free-pour-timer">{formatBrewTime(elapsedMs)}</div>
        <div className="free-pour-live-status">{statusLabel}</div>
        <PourRail
          pours={railPours}
          activePour={activePourView}
          waiting={stage === 'ready' || stage === 'waiting'}
        />
        <div className="free-pour-live-weight">{roundedWeight}g</div>
        <FlowMeter flow={liveFlow} />
        <div className="free-pour-live-instruction">
          {stage === 'ready' ? (
            'START POURING'
          ) : stage === 'waiting' ? (
            <>
              {pours.length < MAX_POURS && <span>POUR AGAIN OR</span>}
              <strong>LIFT BREWER TO FINISH</strong>
            </>
          ) : (
            'POURING'
          )}
        </div>
      </div>
    );
  }

  if (stage === 'finish-requested') {
    return (
      <div className="free-pour-screen free-pour-message-screen">
        <div className="free-pour-step">6 OF 7</div>
        <div className="free-pour-message-main">LIFT BREWER</div>
        <div className="free-pour-message-sub">KEEP SERVER ON SCALE</div>
      </div>
    );
  }

  if (stage === 'measuring') {
    return (
      <div className="free-pour-screen free-pour-message-screen">
        <div className="free-pour-step">6 OF 7</div>
        <div className="free-pour-message-main">
          MEASURING
          <br />
          BREW WEIGHT
        </div>
        <div className="free-pour-message-sub">KEEP SERVER ON SCALE</div>
        <div className="free-pour-stability free-pour-message-stability">
          WEIGHT STABILIZING
        </div>
      </div>
    );
  }

  if (stage === 'replace-server') {
    return (
      <div className="free-pour-screen free-pour-message-screen">
        <div className="free-pour-step">6 OF 7</div>
        <div className="free-pour-message-main">SERVER REMOVED</div>
        <div className="free-pour-message-sub">
          PUT BACK SERVER ONLY
          <br />
          WE’LL MEASURE AUTOMATICALLY
        </div>
        <div className="free-pour-skip">
          BEVERAGE MUST REMAIN · PRESS TO SKIP
        </div>
      </div>
    );
  }

  const beverage = result?.measurements.beverageG;
  return (
    <div className="free-pour-screen free-pour-result-screen">
      <div className="free-pour-step">7 OF 7</div>
      <div className="free-pour-kicker">FREE POUR COMPLETE</div>
      <div className="free-pour-result-value">
        {beverage === null || beverage === undefined
          ? '—'
          : `${Math.round(beverage)}g`}
      </div>
      <div className="free-pour-result-label">BREWED</div>
      <div className="free-pour-result-stats">
        <div>
          <span>WATER POURED</span>
          <strong>{Math.round(result?.measurements.waterPouredG ?? 0)}g</strong>
        </div>
        <div>
          <span>RETAINED</span>
          <strong>
            {result?.measurements.retainedG == null
              ? '—'
              : `${Math.round(result.measurements.retainedG)}g`}
          </strong>
        </div>
      </div>
      <div className="free-pour-result-action">PRESS TO REVIEW</div>
    </div>
  );
};
