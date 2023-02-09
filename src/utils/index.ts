const regex = /^-?[0-9]+$/;

export const roundPrecision = (value: number, precision: number) => {
  const multiplier = Math.pow(10, precision || 0);
  return Math.round(value * multiplier) / multiplier;
};

export const formatStatValue = (value: string, padEnd: number): string => {
  let fValue = 0.0;

  try {
    fValue = parseFloat(value);
  } catch (e) {
    return fValue.toString();
  }

  const finalNumber = roundPrecision(fValue, 1).toString();
  if (regex.test(finalNumber)) {
    return finalNumber + '.' + '0'.repeat(padEnd);
  }
  return finalNumber;
};
