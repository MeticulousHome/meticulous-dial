export const SENTRY_DSN =
  'https://d958eb514629903cf133ad2b19e80ead@sentry.meticulousespresso.com/8';
export const SENTRY_ORIGIN = new URL(SENTRY_DSN).origin;

export const TICKET_SERVICE_URL =
  'https://a3qhsgqqfk.execute-api.us-east-1.amazonaws.com/Prod/ticket';
export const TICKET_SERVICE_ORIGIN = new URL(TICKET_SERVICE_URL).origin;

/** Exactly the two origins used by the dial report flow. */
export const REPORT_PROBE_URLS = [SENTRY_ORIGIN, TICKET_SERVICE_ORIGIN];
