export const NO_WATER_DOT_SIZE = 5;
export const DOT_MAX_SIZE = 22;
export const DOT_MIN_SIZE = 5;
export const DOT_GAP = 3;
export const ROWS = 11;
export const COLS = 6;

export const backgroundWidth = COLS * DOT_MAX_SIZE + (COLS - 1) * DOT_GAP;
export const backgroundHeight = ROWS * DOT_MAX_SIZE + (ROWS - 1) * DOT_GAP;

export const infernoStops = [
  { offset: '00%', color: 'grey' },
  { offset: '15%', color: '#280B54' },
  { offset: '20%', color: '#480B6A' },
  { offset: '25%', color: '#65156E' },
  { offset: '30%', color: '#82206C' },
  { offset: '40%', color: '#9F2A63' },
  { offset: '50%', color: '#BB3755' },
  { offset: '60%', color: '#D44842' },
  { offset: '70%', color: '#E8602D' },
  { offset: '80%', color: '#F44D19' },
  { offset: '100%', color: '#F44D19' }
];
