import { useEffect, useMemo, useState } from 'react';
import { LoadingScreen } from '../../components/LoadingScreen/LoadingScreen';
import { setScreen } from '../../components/store/features/screens/screens-slice';
import { useAppDispatch } from '../../components/store/hooks';
import { useHandleGestures } from '../../hooks/useHandleGestures';
import { clamp, formatBrewTime } from './format';
import { getLatestFreePourSession } from './storage';
import { FreePourSample, FreePourSession } from './types';
import './free-pour-history.css';

const CHART_LEFT = 68;
const CHART_TOP = 108;
const CHART_WIDTH = 344;
const CHART_HEIGHT = 142;
const SCROLL_STEP_MS = 5_000;

const closestSample = (samples: FreePourSample[], timeMs: number) =>
  samples.reduce((closest, sample) =>
    Math.abs(sample.t - timeMs) < Math.abs(closest.t - timeMs)
      ? sample
      : closest
  );

const linePath = (
  samples: FreePourSample[],
  durationMs: number,
  value: (sample: FreePourSample) => number,
  maximum: number
) =>
  samples
    .map((sample, index) => {
      const x = CHART_LEFT + (sample.t / Math.max(1, durationMs)) * CHART_WIDTH;
      const y =
        CHART_TOP +
        CHART_HEIGHT -
        (clamp(value(sample), 0, maximum) / maximum) * CHART_HEIGHT;
      return `${index === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(' ');

export const FreePourHistoryScreen = () => {
  const dispatch = useAppDispatch();
  const [session, setSession] = useState<FreePourSession | null | undefined>(
    undefined
  );
  const [selectedTimeMs, setSelectedTimeMs] = useState(0);

  useEffect(() => {
    getLatestFreePourSession()
      .then(setSession)
      .catch((error) => {
        console.error('Failed to read Free Pour history', error);
        setSession(null);
      });
  }, []);

  const durationMs = session?.measurements.durationMs ?? 0;
  useHandleGestures(
    {
      left() {
        setSelectedTimeMs((time) => Math.max(0, time - SCROLL_STEP_MS));
      },
      right() {
        setSelectedTimeMs((time) =>
          Math.min(durationMs, time + SCROLL_STEP_MS)
        );
      },
      click() {
        dispatch(setScreen('profileHome'));
      },
      pressDown() {
        dispatch(setScreen('profileHome'));
      },
      context() {
        dispatch(setScreen('profileHome'));
      }
    },
    false
  );

  const chart = useMemo(() => {
    if (!session || session.samples.length === 0) return null;
    const maxWeight = Math.max(1, ...session.samples.map((sample) => sample.w));
    return {
      weightPath: linePath(
        session.samples,
        durationMs,
        (sample) => sample.w,
        maxWeight
      ),
      flowPath: linePath(session.samples, durationMs, (sample) => sample.f, 10),
      selected: closestSample(session.samples, selectedTimeMs),
      cursorX:
        CHART_LEFT + (selectedTimeMs / Math.max(1, durationMs)) * CHART_WIDTH
    };
  }, [durationMs, selectedTimeMs, session]);

  if (session === undefined) return <LoadingScreen />;
  if (!session || !chart) {
    return (
      <div className="free-pour-history free-pour-history--empty">
        <strong>NO FREE POUR HISTORY</strong>
        <span>PRESS DIAL TO RETURN</span>
      </div>
    );
  }

  const selectedPour =
    chart.selected.p ||
    [...session.pours]
      .reverse()
      .find((pour) => pour.startTimeMs <= selectedTimeMs)?.number ||
    1;

  return (
    <div className="free-pour-history">
      <div className="free-pour-history-title">FREE POUR</div>
      <div className="free-pour-history-subtitle">
        {session.recipe.doseG}g DOSE ·{' '}
        {Math.round(session.measurements.waterPouredG)}g WATER
      </div>
      <svg
        width="480"
        height="284"
        className="free-pour-history-chart"
        aria-label="Free Pour chart"
      >
        <line
          x1={CHART_LEFT}
          x2={CHART_LEFT + CHART_WIDTH}
          y1={CHART_TOP + CHART_HEIGHT}
          y2={CHART_TOP + CHART_HEIGHT}
          className="free-pour-history-axis"
        />
        {[0, 0.5, 1].map((fraction) => (
          <line
            key={fraction}
            x1={CHART_LEFT}
            x2={CHART_LEFT + CHART_WIDTH}
            y1={CHART_TOP + CHART_HEIGHT * fraction}
            y2={CHART_TOP + CHART_HEIGHT * fraction}
            className="free-pour-history-grid"
          />
        ))}
        {session.pours.map((pour) => {
          const x =
            CHART_LEFT +
            (pour.startTimeMs / Math.max(1, durationMs)) * CHART_WIDTH;
          return (
            <circle
              key={pour.number}
              cx={x}
              cy={CHART_TOP + CHART_HEIGHT}
              r="4"
              className="free-pour-history-pour"
            />
          );
        })}
        <path d={chart.weightPath} className="free-pour-history-weight-line" />
        <path d={chart.flowPath} className="free-pour-history-flow-line" />
        <line
          x1={chart.cursorX}
          x2={chart.cursorX}
          y1={CHART_TOP - 5}
          y2={CHART_TOP + CHART_HEIGHT + 5}
          className="free-pour-history-cursor"
        />
      </svg>
      <div className="free-pour-history-values">
        <div>
          <span>POUR</span>
          <strong>{selectedPour}</strong>
        </div>
        <div>
          <span>TIME</span>
          <strong>{formatBrewTime(selectedTimeMs)}</strong>
        </div>
        <div>
          <span>WATER</span>
          <strong>{Math.round(chart.selected.w)}g</strong>
        </div>
        <div>
          <span>FLOW</span>
          <strong>{Math.round(chart.selected.f)} g/s</strong>
        </div>
      </div>
      <div className="free-pour-history-turn">TURN DIAL · 5 SEC</div>
      <div className="free-pour-history-legend">
        <span>
          <i className="free-pour-history-legend-weight" />
          WEIGHT
        </span>
        <span>
          <i className="free-pour-history-legend-flow" />
          FLOW
        </span>
      </div>
    </div>
  );
};
