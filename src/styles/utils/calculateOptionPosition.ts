import type { QuickSettingOption } from '../../components/QuickSettings/QuickSettings';
import type { SettingsItem } from '../../types/index';
import {
  VIEWPORT_HEIGHT,
  ITEM_HEIGHT,
  ITEM_MARGIN,
  EXTRA_MARGIN_AFTER_BORDER
} from './mixins';

/**
 * Calculates the vertical position of an active option in a quick settings menu,
 * accounting for item heights, margins, and visual separators.
 *
 * @param {Object} params - Configuration parameters.
 * @param {number} params.activeOptionIdx - 0-based index of the currently active option.
 * @param {(position: number) => number} [params.adjustmentFn] - Optional function to adjust
 * the calculated position (e.g., for viewport offset for Inner OptionsContainer).
 * @param {QuickSettingOption[]} params.settings - Full array of setting options,
 * used to detect visual separators requiring extra margins.
 *
 * @returns {number} - Final vertical position in pixels. If `adjustmentFn` is provided,
 * returns the result of applying it to the base position. Otherwise, returns the base position.
 *
 * @example
 * // Get position for the 3rd option (index 2)
 * const position = calculateOptionPosition({
 *   activeOptionIdx: 2,
 *   settings: currentSettings,
 *   adjustmentFn: (pos) => pos - VIEWPORT_HEIGHT / 2
 * });
 *
 * @remarks
 * - Base calculation:
 *   `(Viewport height / 2) - (Accumulated offset) - (Half the item's height)`
 * - Accumulated offset: Sum of:
 *   - (Item height + Standard margin) for each preceding item
 *   - Extra margin (`EXTRA_MARGIN_AFTER_BORDER`) if the item has a visual separator
 */

type SettingsArray = (SettingsItem | QuickSettingOption)[];
export const calculateOptionPosition = ({
  activeOptionIdx,
  adjustmentFn,
  settings
}: {
  activeOptionIdx: number;
  adjustmentFn?: (position: number) => number;
  settings: SettingsArray;
}): number => {
  const halfContainer = VIEWPORT_HEIGHT / 2;
  const halfItem = ITEM_HEIGHT / 2;

  const totalOffset = settings
    .slice(0, activeOptionIdx)
    .reduce((acc, element) => {
      const baseOffset = acc + ITEM_HEIGHT + ITEM_MARGIN;
      return element.hasSeparator
        ? baseOffset + EXTRA_MARGIN_AFTER_BORDER
        : baseOffset;
    }, 0);

  // Añadimos 2px al cálculo base
  const basePosition = halfContainer - totalOffset - halfItem + 2;

  return adjustmentFn ? adjustmentFn(basePosition) : basePosition;
};
