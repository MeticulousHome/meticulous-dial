export type SetupStage = 'server' | 'brewer' | 'coffee';
export type SetupStatus = 'idle' | 'saving' | 'taring' | 'tare-timeout';

// Setup loads only need to clear scale noise. Do not assume a minimum server or
// brewer weight: the incoming reading may include a tare offset from earlier use.
export const SETUP_LOAD_CHANGE_G = 1.2;

export const isValidSetupWeight = (stage: SetupStage, weight: number) => {
  if (stage === 'server') return true;
  if (stage === 'brewer') return weight >= SETUP_LOAD_CHANGE_G;
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
