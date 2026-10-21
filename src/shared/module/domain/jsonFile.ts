import { InvalidProjectFileError } from './errors.js';

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** Reads a JSON file of the generated project, which must contain an object. */
export const parseJsonObject = (path: string, content: string): Record<string, unknown> => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch (error) {
    throw new InvalidProjectFileError(path, (error as Error).message);
  }

  if (!isRecord(parsed)) {
    throw new InvalidProjectFileError(path, 'a JSON object is expected');
  }
  return parsed;
};
