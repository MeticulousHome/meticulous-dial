type LogValue = string | number | boolean | null | undefined;

type LogDetails = Record<string, LogValue>;

const serializeError = (error: unknown) => {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack
    };
  }

  return { message: String(error) };
};

export const logFreePour = (event: string, details: LogDetails = {}) => {
  console.info(`[FreePour] ${JSON.stringify({ event, ...details })}`);
};

export const logFreePourError = (
  event: string,
  error: unknown,
  details: LogDetails = {}
) => {
  console.error(
    `[FreePour] ${JSON.stringify({
      event,
      ...details,
      error: serializeError(error)
    })}`
  );
};
