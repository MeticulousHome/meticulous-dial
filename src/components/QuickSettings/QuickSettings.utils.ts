const ITEM_HEIGHT = 38;
const ITEM_MARGIN = 25;
const EXTRA_MARGIN_AFTER_DELETE = 10;
export const VIEWPORT_HEIGHT = 480;

/**
 * Calculates the position of an item with a custom adjustment function.
 *
 * @param {number} activeOption - The index of the active option (e.g., 0-based).
 * @param {function(number): number} adjustmentFn - A function that adjusts the calculated position.
 * This function receives the base position as an argument and returns the adjusted position.
 * @returns {number} The adjusted position based on the provided adjustment function.
 *
 * @example
 * // Example usage with no adjustment
 * const noAdjustment = (position) => position;
 * const position = calculatePositionWithAdjustment(2, noAdjustment);
 *
 * @example
 * // Example usage with a custom adjustment
 * const darkTextAdjustment = (position) => position - 100;
 * const adjustedPosition = calculatePositionWithAdjustment(2, darkTextAdjustment);
 *
 *
 */

export const calculateOptionPosition = ({
  activeOptionIdx,
  adjustmentFn,
  lastProfileContextIndex = -1
}: {
  activeOptionIdx: number;
  adjustmentFn?: (position: number) => number;
  lastProfileContextIndex?: number; // <- Añadido aquí
}): number => {
  const halfContainer = VIEWPORT_HEIGHT / 2;
  const halfItem = ITEM_HEIGHT / 2;
  let totalOffset = activeOptionIdx * (ITEM_HEIGHT + ITEM_MARGIN);

  if (
    lastProfileContextIndex !== -1 &&
    activeOptionIdx > lastProfileContextIndex
  ) {
    totalOffset += EXTRA_MARGIN_AFTER_DELETE;
  }

  const basePosition = halfContainer - totalOffset - halfItem;

  return adjustmentFn ? adjustmentFn(basePosition) : basePosition;
};
