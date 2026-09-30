/**
 * Decide where the dial goes once the boot animation finishes.
 *
 * The shot data sharing setting is tri-state on the backend: `null` means
 * the user has never answered, so the full screen prompt is shown once per
 * boot until they pick "Help improve" (true) or "No thanks" (false). When the
 * settings are not available yet the dial goes to the home screen as before.
 */
export type PostReadyScreen = 'profileHome' | 'shotDataSharingPrompt';

export function resolvePostReadyScreen(
  settings?: { shot_data_sharing?: boolean | null } | null
): PostReadyScreen {
  return settings?.shot_data_sharing === null
    ? 'shotDataSharingPrompt'
    : 'profileHome';
}
