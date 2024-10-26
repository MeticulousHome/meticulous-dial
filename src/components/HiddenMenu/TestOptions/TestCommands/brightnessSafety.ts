import { setLCDBrightnessTesting } from '../legacyApi';

let brightnessTimer: NodeJS.Timeout | null = null;

export const handleBrightnessSafety = async (
  value: number,
  onRestore?: (restoredValue: number) => void
): Promise<boolean> => {
  try {
    // Clear any existing timer
    if (brightnessTimer) {
      console.log('Clearing existing brightness timer');
      clearTimeout(brightnessTimer);
      brightnessTimer = null;
    }

    const result = await setLCDBrightnessTesting(value);

    if (value < 5) {
      console.log('Brightness is dangerously low, setting timer to restore it');
      brightnessTimer = setTimeout(async () => {
        try {
          console.log('Restoring brightness to 90');
          await setLCDBrightnessTesting(90);
          onRestore?.(90);
          console.log('Brightness restored successfully');
          brightnessTimer = null;
        } catch (error) {
          console.error('Error restoring brightness:', error);
        }
      }, 1500);
    }

    return result;
  } catch (error) {
    console.error('Error in handleBrightnessSafety:', error);
    try {
      await setLCDBrightnessTesting(90);
      onRestore?.(90);
    } catch (restoreError) {
      console.error('Error restoring brightness after error:', restoreError);
    }
    return false;
  }
};
