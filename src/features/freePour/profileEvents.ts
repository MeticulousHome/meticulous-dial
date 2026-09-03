export const isPourOverProfileEvent = (event: unknown): boolean =>
  Boolean(
    event &&
    typeof event === 'object' &&
    'brew_type' in event &&
    event.brew_type === 'pour_over'
  );
