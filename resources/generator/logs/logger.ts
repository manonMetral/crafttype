const LEVELS = ['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'];

/** Options du logger Fastify (pino) : niveau choisi par LOG_LEVEL (info par défaut), niveau écrit en toutes lettres. */
export function loggerOptions(
  env: Readonly<Record<string, string | undefined>> = process.env,
) {
  return {
    level: parseLevel(env['LOG_LEVEL']),
    formatters: { level: (label: string) => ({ level: label }) },
  };
}

function parseLevel(value: string | undefined): string {
  const level = value?.trim().toLowerCase() ?? '';
  if (level === '') {
    return 'info';
  }
  if (!LEVELS.includes(level)) {
    throw new Error(
      `LOG_LEVEL invalide : « ${value} » (${LEVELS.join(', ')} attendus)`,
    );
  }
  return level;
}
