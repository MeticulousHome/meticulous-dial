import { roundTo } from './format';
import { FreePourSession, PourOverProfile } from './types';

export const DEFAULT_FREE_POUR_TEMPERATURE_C = 92;
export const MIN_FREE_POUR_TEMPERATURE_C = 80;
export const MAX_FREE_POUR_TEMPERATURE_C = 100;

export const createRepeatPourOverProfile = (
  session: FreePourSession
): PourOverProfile | null => {
  if (!session.pours.length) return null;

  const measuredTemperature =
    session.measurements.waterTemperatureC ??
    session.recipe.temperatureC ??
    DEFAULT_FREE_POUR_TEMPERATURE_C;
  const measuredDose = session.measurements.doseG ?? session.recipe.doseG;

  return {
    id: `repeat-${session.id}`,
    name: 'Repeat Last Pour',
    sourceSessionId: session.id,
    doseG: roundTo(measuredDose),
    temperatureC: Math.round(measuredTemperature),
    targetWaterG: roundTo(session.measurements.waterPouredG),
    targetDurationMs: Math.round(session.measurements.durationMs),
    pourTargets: session.pours.map((pour) => ({
      number: pour.number,
      startTimeMs: pour.startTimeMs,
      stopWeightG: roundTo(pour.endWeightG),
      flowGps: roundTo(pour.averageFlowGps)
    }))
  };
};
