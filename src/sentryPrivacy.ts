import type { ErrorEvent } from '@sentry/react';

const sensitiveKeys = new Set([
  'password',
  'passwd',
  'secret',
  'token',
  'credential',
  'authorization',
  'cookie',
  'api_key',
  'auth_key',
  'root_password',
  'ssid',
  'apname',
  'knownwifis',
  'ip',
  'ip_address',
  'ipaddress',
  'client_ip',
  'remote_addr',
  'hostname',
  'machine_name',
  'email',
  'username'
]);

const normalizedKey = (key: string) =>
  key.trim().toLowerCase().replace(/[- ]/g, '_');

const isSensitiveKey = (key: string) => {
  const normalized = normalizedKey(key);
  return (
    sensitiveKeys.has(normalized) ||
    [...sensitiveKeys].some(
      (part) =>
        normalized.startsWith(`${part}_`) ||
        normalized.endsWith(`_${part}`) ||
        normalized.includes(`_${part}_`)
    )
  );
};

const scrubStructuredValue = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map(scrubStructuredValue);
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => !isSensitiveKey(key))
        .map(([key, item]) => [key, scrubStructuredValue(item)])
    );
  }

  return value;
};

const removeFrameVariables = (event: ErrorEvent) => {
  event.exception?.values?.forEach((exception) => {
    exception.stacktrace?.frames?.forEach((frame) => {
      delete frame.vars;
    });
  });
};

export const sanitizeAutomaticSentryEvent = (event: ErrorEvent): ErrorEvent => {
  const sanitized = structuredClone(event);
  delete sanitized.breadcrumbs;
  delete sanitized.request;
  delete sanitized.user;
  delete sanitized.server_name;

  if (sanitized.tags) {
    sanitized.tags = Object.fromEntries(
      Object.entries(sanitized.tags).filter(
        ([key]) =>
          !['machine', 'machine_name', 'hostname'].includes(
            normalizedKey(key)
          ) && !isSensitiveKey(key)
      )
    );
  }

  if (sanitized.contexts) {
    sanitized.contexts = scrubStructuredValue(
      sanitized.contexts
    ) as ErrorEvent['contexts'];
  }

  if (sanitized.extra) {
    sanitized.extra = scrubStructuredValue(
      sanitized.extra
    ) as ErrorEvent['extra'];
  }

  removeFrameVariables(sanitized);
  return sanitized;
};
