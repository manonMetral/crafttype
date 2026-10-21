export interface ServerConfig {
  readonly port: number;
  readonly host: string;
}

const MAX_PORT = 65_535;

/**
 * Complète les valeurs par défaut de `main.ts` avec l'environnement (PORT, HOST)
 * et refuse au démarrage une valeur invalide.
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
      `PORT invalide : « ${text} » (entier de 1 à ${MAX_PORT} attendu)`,
    );
  }
  return port;
}

function parseHost(value: string | undefined, fallback: string): string {
  const host = value?.trim() ?? '';
  return host === '' ? fallback : host;
}
