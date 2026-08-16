import { useEffect, useMemo, useRef, useState } from 'react';
import { useHandleGestures } from '../../hooks/useHandleGestures';
import { useIdleTimer } from '../../hooks/useIdleTimer';
import { useAppDispatch, useAppSelector } from '../../components/store/hooks';
import { useSocket } from '../../components/store/SocketManager';
import {
  setBubbleDisplay,
  setScreen
} from '../../components/store/features/screens/screens-slice';
import { colorDataBlueLight } from '../../constants/colors';
import { clamp, formatBrewTime, roundTo } from './format';
import { DetectorSample, PourDetector } from './pourDetector';
import { saveFreePourSession } from './storage';
import { logFreePour, logFreePourError } from './logging';
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
  | 'brewer'
  | 'coffee'
  | 'recipe'
  | 'ready'
  | 'pouring'
  | 'waiting'
  | 'finish-requested'
  | 'measuring'
  | 'replace-server'
  | 'result';

type SetupStage = Extract<Stage, 'server' | 'brewer' | 'coffee'>;
type SetupStatus = 'idle' | 'saving' | 'taring' | 'tare-timeout';

const SAMPLE_INTERVAL_MS = 200;
const MAX_POURS = 5;
const TARE_CONFIRM_TOLERANCE_G = 0.6;
const TARE_CONFIRM_TIMEOUT_MS = 5000;

const isSetupStage = (stage: Stage): stage is SetupStage =>
  stage === 'server' || stage === 'brewer' || stage === 'coffee';

const isValidSetupWeight = (stage: SetupStage, weight: number) => {
  if (stage === 'server') return weight >= 20;
  if (stage === 'brewer') return weight >= 10;
  return weight >= 5 && weight <= 40;
};

const nextStageAfterTare = (stage: SetupStage): Stage => {
  if (stage === 'server') return 'brewer';
  if (stage === 'brewer') return 'coffee';
  return 'recipe';
};

const stepForStage = (stage: Stage) => {
  if (stage === 'server') return 1;
  if (stage === 'brewer') return 2;
  if (stage === 'coffee') return 3;
  if (stage === 'recipe') return 4;
  if (stage === 'ready' || stage === 'pouring') return 5;
  if (stage === 'waiting') return 6;
  if (stage === 'finish-requested' || stage === 'measuring') return 7;
  return 8;
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
  const bubbleDisplay = useAppSelector((state) => state.screen.bubbleDisplay);
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
  const [setupStatus, setSetupStatus] = useState<SetupStatus>('idle');
  const stable = useStableWeight(weight, stage);
  const serverReady = stable && weight >= 20;
  const brewerReady = stable && weight >= 10;
  const coffeeReady = stable && weight >= 5 && weight <= 40;

  const stageRef = useRef(stage);
  const weightRef = useRef(weight);
  const flowRef = useRef(gravimetricFlow);
  const detector = useRef(new PourDetector());
  const serverWeight = useRef(0);
  const brewerWeight = useRef(0);
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
  const setupStatusRef = useRef(setupStatus);
  const sessionSaved = useRef(false);
  const [runId] = useState(
    () =>
      globalThis.crypto?.randomUUID?.() ??
      `free-pour-run-${Date.now()}-${Math.round(Math.random() * 100000)}`
  );

  stageRef.current = stage;
  weightRef.current = weight;
  flowRef.current = gravimetricFlow;
  setupStatusRef.current = setupStatus;

  const updateStage = (next: Stage) => {
    const previous = stageRef.current;
    if (previous === next) return;
    logFreePour('stage_changed', { runId, from: previous, to: next });
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
    logFreePour('pour_ended', {
      runId,
      pour: finished.number,
      start_ms: finished.startTimeMs,
      end_ms: finished.endTimeMs,
      water_g: finished.waterG,
      average_flow_gps: finished.averageFlowGps,
      peak_flow_gps: finished.peakFlowGps
    });
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
        brewerG: roundTo(brewerWeight.current),
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
    logFreePour('session_completed', {
      runId,
      duration_ms: session.measurements.durationMs,
      pours: session.pours.length,
      water_g: session.measurements.waterPouredG,
      beverage_g: session.measurements.beverageG,
      retained_g: session.measurements.retainedG,
      completion: session.completion
    });
    setResult(session);
    updateStage('result');
    saveFreePourSession(session)
      .then(() => {
        sessionSaved.current = true;
        logFreePour('session_saved', { runId, sessionId: session.id });
      })
      .catch((error) => {
        logFreePourError('session_save_failed', error, {
          runId,
          sessionId: session.id
        });
      });
  };

  const beginMeasurement = (timeMs: number) => {
    if (finalizing.current) return;
    finalizing.current = true;
    if (activePour.current) finishActivePour(timeMs, peakWaterWeight.current);
    detector.current.reset();
    logFreePour('brew_weight_measurement_started', {
      runId,
      elapsed_ms: Math.round(elapsedMsRef.current),
      scale_g: roundTo(weightRef.current)
    });
    updateStage('measuring');
  };

  useEffect(() => {
    logFreePour('screen_entered', { runId, stage: 'server' });
    return () => {
      logFreePour('screen_exited', {
        runId,
        stage: stageRef.current,
        session_saved: sessionSaved.current
      });
    };
  }, [runId]);

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
          logFreePour('brewer_removal_detected', {
            runId,
            scale_g: roundTo(currentWeight),
            peak_water_g: roundTo(peakWaterWeight.current),
            threshold_g: roundTo(removalThreshold)
          });
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
          logFreePour('pour_started', {
            runId,
            pour: nextPour.number,
            start_ms: Math.round(nextPour.startTimeMs),
            start_weight_g: roundTo(nextPour.startWeightG),
            flow_gps: roundTo(event.sample.flowGps)
          });
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
      logFreePour('brew_weight_accepted', {
        runId,
        beverage_g: roundTo(candidateBeverage),
        water_g: roundTo(water)
      });
      createSession(candidateBeverage);
    } else if (candidateBeverage <= Math.max(5, water * 0.08)) {
      logFreePour('server_missing_after_brewer_removal', {
        runId,
        candidate_beverage_g: roundTo(candidateBeverage),
        water_g: roundTo(water)
      });
      finalizing.current = false;
      updateStage('replace-server');
    } else if (candidateBeverage > water + 8) {
      // A transient bump can resemble a lift. Return to the live state once
      // the full setup is stable on the scale again.
      logFreePour('brewer_removal_rejected', {
        runId,
        reason: 'weight_above_plausible_range',
        candidate_beverage_g: roundTo(candidateBeverage),
        water_g: roundTo(water)
      });
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
      logFreePour('replacement_server_accepted', {
        runId,
        beverage_g: roundTo(candidateBeverage),
        water_g: roundTo(water)
      });
      createSession(candidateBeverage);
    }
  }, [stable, stage, weight]);

  useEffect(() => {
    if (setupStatus !== 'saving' || !stable || !isSetupStage(stage)) return;

    if (!isValidSetupWeight(stage, weight)) {
      logFreePour('weight_save_cancelled', {
        runId,
        stage,
        reason: 'weight_out_of_range',
        weight_g: roundTo(weight)
      });
      setSetupStatus('idle');
      return;
    }

    if (stage === 'server') {
      serverWeight.current = weight;
    } else if (stage === 'brewer') {
      brewerWeight.current = weight;
    } else {
      const measuredDose = weight;
      setDoseG(Math.round(measuredDose));
      setupWeight.current = brewerWeight.current + measuredDose;
    }

    logFreePour('weight_saved', {
      runId,
      stage,
      weight_g: roundTo(weight)
    });
    setSetupStatus('taring');
    socket.emit('action', 'tare');
    logFreePour('tare_requested', { runId, stage });
  }, [setupStatus, stable, stage, weight, socket, runId]);

  useEffect(() => {
    if (
      setupStatus !== 'taring' ||
      !stable ||
      !isSetupStage(stage) ||
      Math.abs(weight) > TARE_CONFIRM_TOLERANCE_G
    ) {
      return;
    }

    logFreePour('tare_confirmed', {
      runId,
      stage,
      weight_g: roundTo(weight)
    });
    setSetupStatus('idle');
    updateStage(nextStageAfterTare(stage));
  }, [setupStatus, stable, stage, weight, runId]);

  useEffect(() => {
    if (setupStatus !== 'taring' || !isSetupStage(stage)) return;

    const taringStage = stage;
    const timeout = window.setTimeout(() => {
      logFreePour('tare_timed_out', {
        runId,
        stage: taringStage,
        weight_g: roundTo(weightRef.current)
      });
      setSetupStatus('tare-timeout');
    }, TARE_CONFIRM_TIMEOUT_MS);

    return () => window.clearTimeout(timeout);
  }, [setupStatus, stage, runId]);

  useHandleGestures(
    {
      click() {
        const currentStage = stageRef.current;
        const currentWeight = weightRef.current;
        const currentSetupStatus = setupStatusRef.current;
        logFreePour('click_received', {
          runId,
          stage: currentStage,
          setup_status: currentSetupStatus,
          stable,
          weight_g: roundTo(currentWeight)
        });

        if (isSetupStage(currentStage)) {
          if (currentSetupStatus === 'tare-timeout') {
            setSetupStatus('taring');
            socket.emit('action', 'tare');
            logFreePour('tare_retried', { runId, stage: currentStage });
            return;
          }
          if (currentSetupStatus !== 'idle') {
            logFreePour('click_ignored', {
              runId,
              stage: currentStage,
              reason: currentSetupStatus
            });
            return;
          }
          if (!isValidSetupWeight(currentStage, currentWeight)) {
            logFreePour('click_rejected', {
              runId,
              stage: currentStage,
              reason: 'weight_out_of_range',
              weight_g: roundTo(currentWeight)
            });
            return;
          }
          setSetupStatus('saving');
          logFreePour('weight_save_requested', {
            runId,
            stage: currentStage,
            stable,
            weight_g: roundTo(currentWeight)
          });
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
          logFreePour('brew_weight_skipped', { runId });
          createSession(null);
          return;
        }
        if (currentStage === 'result') {
          logFreePour('review_opened', { runId });
          dispatch(setScreen('freePourHistory'));
          return;
        }

        logFreePour('click_ignored', {
          runId,
          stage: currentStage,
          reason: 'no_action_for_stage'
        });
      },
      doubleClick() {
        const currentStage = stageRef.current;
        logFreePour(currentStage === 'result' ? 'exited' : 'aborted', {
          runId,
          source: 'double_press',
          stage: currentStage
        });
        dispatch(setBubbleDisplay({ visible: false, component: undefined }));
        dispatch(setScreen('profileHome'));
      },
      context() {
        logFreePour('context_opened', {
          runId,
          stage: stageRef.current
        });
      }
    },
    bubbleDisplay.interceptsGesture
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

  if (stage === 'brewer') {
    return (
      <div className="free-pour-screen free-pour-setup-screen">
        <div className="free-pour-step">2 OF 8</div>
        <div className="free-pour-kicker">ADD BREWER</div>
        <div className="free-pour-setup-weight">{Math.round(weight)}g</div>
        <div className="free-pour-stability">
          {setupStatus === 'saving'
            ? 'KEEP SCALE STILL'
            : setupStatus === 'taring'
              ? 'WAITING FOR ZERO'
              : setupStatus === 'tare-timeout'
                ? 'TARE NOT CONFIRMED'
                : weight < 10
                  ? 'PLACE BREWER ON SERVER'
                  : brewerReady
                    ? 'WEIGHT STABLE'
                    : 'WAITING FOR STABLE WEIGHT'}
        </div>
        <div
          className={`free-pour-dose-action ${
            setupStatus === 'idle' && weight < 10
              ? 'free-pour-dose-action--disabled'
              : ''
          }`}
        >
          {setupStatus === 'saving' ? (
            <strong>SAVING WEIGHT</strong>
          ) : setupStatus === 'taring' ? (
            <strong>TARING…</strong>
          ) : setupStatus === 'tare-timeout' ? (
            <strong>PRESS DIAL TO RETRY</strong>
          ) : (
            <>
              <span>PRESS DIAL TO SAVE</span>
              <strong>BREWER + TARE</strong>
            </>
          )}
        </div>
      </div>
    );
  }

  if (stage === 'coffee') {
    return (
      <div className="free-pour-screen free-pour-setup-screen">
        <div className="free-pour-step">3 OF 8</div>
        <div className="free-pour-kicker">ADD COFFEE</div>
        <div className="free-pour-setup-weight">{Math.round(weight)}g</div>
        <div className="free-pour-stability">
          {setupStatus === 'saving'
            ? 'KEEP SCALE STILL'
            : setupStatus === 'taring'
              ? 'WAITING FOR ZERO'
              : setupStatus === 'tare-timeout'
                ? 'TARE NOT CONFIRMED'
                : weight < 5
                  ? 'ADD 5–40g COFFEE'
                  : weight > 40
                    ? 'DOSE MUST BE 5–40g'
                    : coffeeReady
                      ? 'DOSE READY'
                      : 'WAITING FOR STABLE WEIGHT'}
        </div>
        <div
          className={`free-pour-dose-action ${
            setupStatus === 'idle' && (weight < 5 || weight > 40)
              ? 'free-pour-dose-action--disabled'
              : ''
          }`}
        >
          {setupStatus === 'saving' ? (
            <strong>SAVING WEIGHT</strong>
          ) : setupStatus === 'taring' ? (
            <strong>TARING…</strong>
          ) : setupStatus === 'tare-timeout' ? (
            <strong>PRESS DIAL TO RETRY</strong>
          ) : (
            <>
              <span>PRESS DIAL TO SAVE</span>
              <strong>DOSE + TARE</strong>
            </>
          )}
        </div>
      </div>
    );
  }

  if (stage === 'server') {
    return (
      <div className="free-pour-screen free-pour-setup-screen">
        <div className="free-pour-step">1 OF 8</div>
        <div className="free-pour-kicker">EMPTY SERVER</div>
        <div className="free-pour-setup-weight">{Math.round(weight)}g</div>
        <div className="free-pour-stability">
          {setupStatus === 'saving'
            ? 'KEEP SCALE STILL'
            : setupStatus === 'taring'
              ? 'WAITING FOR ZERO'
              : setupStatus === 'tare-timeout'
                ? 'TARE NOT CONFIRMED'
                : weight < 20
                  ? 'PLACE EMPTY SERVER'
                  : serverReady
                    ? 'WEIGHT STABLE'
                    : 'WAITING FOR STABLE WEIGHT'}
        </div>
        <div className="free-pour-setup-action">
          {setupStatus === 'saving'
            ? 'SAVING WEIGHT'
            : setupStatus === 'taring'
              ? 'TARING…'
              : setupStatus === 'tare-timeout'
                ? 'PRESS DIAL TO RETRY'
                : 'PRESS DIAL TO SAVE + TARE'}
        </div>
      </div>
    );
  }

  if (stage === 'recipe') {
    return (
      <div className="free-pour-screen free-pour-recipe-screen">
        <div className="free-pour-step">4 OF 8</div>
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
        <div className="free-pour-step">{step} OF 8</div>
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
        <div className="free-pour-step">7 OF 8</div>
        <div className="free-pour-message-main">LIFT BREWER</div>
        <div className="free-pour-message-sub">KEEP SERVER ON SCALE</div>
      </div>
    );
  }

  if (stage === 'measuring') {
    return (
      <div className="free-pour-screen free-pour-message-screen">
        <div className="free-pour-step">7 OF 8</div>
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
        <div className="free-pour-step">7 OF 8</div>
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
      <div className="free-pour-step">8 OF 8</div>
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
