export function clampPairedDeviceIndex(index: number, optionCount: number) {
  return Math.min(Math.max(index, 0), Math.max(optionCount - 1, 0));
}
