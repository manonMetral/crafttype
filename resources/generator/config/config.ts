export interface ServerConfig {
  readonly port: number;
  readonly host: string;
}

const MAX_PORT = 65_535;

/**
 * Completes the defaults from `main.ts` with the environment (PORT, HOST)
 * and rejects an invalid value at startup.
 */
export function loadConfig(
  defaults: ServerConfig,
  env: Readonly<Record<string, string | undefined>> = process.env,
): ServerConfig {
  return {
    port: parsePort(env['PORT'], defaults.port),
    host: parseHost(env['HOST'], defaults.host),
  };
}

function parsePort(value: string | undefined, fallback: number): number {
  const text = value?.trim() ?? '';
  if (text === '') {
    return fallback;
  }

  const port = /^\d+$/.test(text) ? Number(text) : Number.NaN;
  if (!Number.isInteger(port) || port < 1 || port > MAX_PORT) {
    throw new Error(
      `Invalid PORT: "${text}" (expected an integer from 1 to ${MAX_PORT})`,
    );
  }
  return port;
}

function parseHost(value: string | undefined, fallback: string): string {
  const host = value?.trim() ?? '';
  return host === '' ? fallback : host;
}
