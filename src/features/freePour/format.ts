export const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

export const roundTo = (value: number, decimals = 1) => {
  const multiplier = 10 ** decimals;
  return Math.round(value * multiplier) / multiplier;
};

export const formatBrewTime = (milliseconds: number) => {
  const seconds = Math.max(0, Math.floor(milliseconds / 1000));
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, '0')}`;
};

export const formatClockTime = (milliseconds: number) => {
  const seconds = Math.max(0, Math.floor(milliseconds / 1000));
  if (seconds < 60) return `${seconds}s`;
  return formatBrewTime(milliseconds);
};
