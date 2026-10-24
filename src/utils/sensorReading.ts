// The backend sends a sensor it has no reading for as the string "NaN" (a
// machine whose scale reports nothing has "weight": "NaN" in its status and in
// every sample of its shots), and a reading can also be null. Only a finite
// number is a reading.
export const isReading = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

// Where a value must be printed or drawn, a missing reading counts as 0.
export const readingOrZero = (value: unknown): number =>
  isReading(value) ? value : 0;
