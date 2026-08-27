import type {
  DynamicValue,
  IdleBinding,
  IdleCondition,
  IdleDataContext,
  IdleFormatter,
  IdleTokens
} from './types';

export function resolveDynamicValue(
  value: DynamicValue | undefined,
  context: IdleDataContext,
  tokens: IdleTokens
): unknown {
  if (value == null || typeof value !== 'object') return value;
  if ('token' in value) return resolveToken(value.token, tokens);
  if ('binding' in value) return resolveBinding(value.binding, context);
  return value;
}

export function resolveBinding(
  binding: IdleBinding,
  context: IdleDataContext
): unknown {
  const raw = getSourceValue(context, binding.source, binding.path);
  const value = raw ?? binding.fallback;
  if (value == null) return value;
  return binding.formatter ? formatValue(value, binding.formatter) : value;
}

export function resolveCondition(
  condition: IdleCondition,
  context: IdleDataContext
): boolean {
  const value = getSourceValue(context, condition.source, condition.path);
  if (value == null) return condition.fallback ?? false;
  switch (condition.operator) {
    case 'truthy':
      return Boolean(value);
    case 'falsy':
      return !value;
    case 'present':
      return value !== undefined && value !== null && value !== '';
    case 'eq':
      return value === condition.value;
    case 'neq':
      return value !== condition.value;
    case 'gt':
    case 'gte':
    case 'lt':
    case 'lte':
      return compareNumbers(value, condition.value, condition.operator);
  }
}

export function formatValue(value: unknown, formatter: IdleFormatter): string {
  switch (formatter.type) {
    case 'number':
      return Number(value).toFixed(formatter.precision ?? 0);
    case 'unit':
      return `${Number(value).toFixed(formatter.precision ?? 0)}${
        formatter.suffix ?? ''
      }`;
    case 'date':
      return formatDate(value, formatter, false);
    case 'time':
      return formatDate(value, formatter, true);
    case 'duration':
      return formatDuration(Number(value));
    case 'boolean':
      return Boolean(value)
        ? (formatter.trueLabel ?? 'true')
        : (formatter.falseLabel ?? 'false');
    case 'enum':
      return formatter.map?.[String(value)] ?? String(value);
    case 'truncate': {
      const text = String(value);
      const maxLength = formatter.maxLength ?? text.length;
      return text.length > maxLength ? text.slice(0, maxLength) : text;
    }
  }
}

function getSourceValue(
  context: IdleDataContext,
  source: keyof IdleDataContext,
  path: string
): unknown {
  return path.split('.').reduce<unknown>((current, segment) => {
    if (current && typeof current === 'object' && segment in current) {
      return (current as Record<string, unknown>)[segment];
    }
    return undefined;
  }, context[source]);
}

function resolveToken(token: string, tokens: IdleTokens): unknown {
  const [scope, key] = token.split('.');
  if (scope === 'colors') return tokens.colors[key];
  if (scope === 'fonts') return tokens.fonts[key];
  if (scope === 'numbers') return tokens.numbers[key];
  if (scope === 'strings') return tokens.strings?.[key];
  if (scope === 'booleans') return tokens.booleans?.[key];
  return undefined;
}

function compareNumbers(
  left: unknown,
  right: unknown,
  operator: 'gt' | 'gte' | 'lt' | 'lte'
): boolean {
  const a = Number(left);
  const b = Number(right);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return false;
  if (operator === 'gt') return a > b;
  if (operator === 'gte') return a >= b;
  if (operator === 'lt') return a < b;
  return a <= b;
}

function formatDate(
  value: unknown,
  formatter: IdleFormatter,
  timeOnly: boolean
): string {
  const date = value instanceof Date ? value : new Date(Number(value));
  if (Number.isNaN(date.getTime())) return '';
  const locale = formatter.locale;
  const options =
    formatter.options ??
    (timeOnly ? { hour: '2-digit', minute: '2-digit' } : {});
  return new Intl.DateTimeFormat(locale, options).format(date);
}

function formatDuration(milliseconds: number): string {
  if (!Number.isFinite(milliseconds)) return '';
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}
