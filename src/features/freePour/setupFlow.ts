export type SetupStage = 'server' | 'brewer' | 'coffee';
export type SetupStatus = 'idle' | 'saving' | 'taring' | 'tare-timeout';

// Setup loads only need to clear scale noise. A just-tared zero represents an
// integrated brewer; otherwise require a meaningful load change.
export const SETUP_LOAD_CHANGE_G = 1.2;
export const SETUP_ZERO_WEIGHT_TOLERANCE_G = 0.6;

export const isZeroBrewerWeight = (weight: number) =>
  Number.isFinite(weight) && Math.abs(weight) <= SETUP_ZERO_WEIGHT_TOLERANCE_G;

export const normalizeBrewerWeight = (weight: number) =>
  isZeroBrewerWeight(weight) ? 0 : weight;

export const isValidSetupWeight = (stage: SetupStage, weight: number) => {
  if (!Number.isFinite(weight)) return false;
  if (stage === 'server') return true;
  if (stage === 'brewer') {
    return isZeroBrewerWeight(weight) || weight >= SETUP_LOAD_CHANGE_G;
  }
  return weight >= 5 && weight <= 40;
};

export const canRecordSetupWeight = ({
  stage,
  weight,
  stable,
  status
}: {
  stage: SetupStage;
  weight: number;
  stable: boolean;
  status: SetupStatus;
}) => status === 'idle' && stable && isValidSetupWeight(stage, weight);

export const nextStageAfterTare = (stage: SetupStage) => {
  if (stage === 'server') return 'brewer' as const;
  if (stage === 'brewer') return 'coffee' as const;
  return 'ready' as const;
};
