import { createHmac, timingSafeEqual } from 'node:crypto';

export interface JwtClaims {
  readonly sub: string;
  readonly role?: string;
}

export interface VerifiedJwtClaims extends JwtClaims {
  readonly iat: number;
  readonly exp: number;
}

export interface JwtService {
  sign(claims: JwtClaims): string;
  verify(token: string): VerifiedJwtClaims;
}

const DEFAULT_TTL_SECONDS = 3600;
const HEADER = encodeBase64Url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));

function normalizeBase64Url(value: string): string {
  return value.replaceAll('=', '').replaceAll('+', '-').replaceAll('/', '_');
}

function encodeBase64Url(value: string): string {
  return normalizeBase64Url(Buffer.from(value, 'utf8').toString('base64'));
}

export const createJwtService = (
  secret: string,
  ttlSeconds = DEFAULT_TTL_SECONDS,
  now: () => number = Date.now,
): JwtService => {
  const normalizedSecret = secret.trim();
  if (normalizedSecret === '') {
    throw new Error('Invalid AUTH_JWT_SECRET: expected a non-empty string');
  }
  if (!Number.isInteger(ttlSeconds) || ttlSeconds < 1) {
    throw new Error('Invalid token TTL: expected an integer greater than 0');
  }

  return {
    sign: (claims) => {
      const subject = claims.sub.trim();
      if (subject === '') {
        throw new Error('Invalid JWT subject: expected a non-empty string');
      }

      const issuedAt = Math.floor(now() / 1000);
      const payload = encodeBase64Url(
        JSON.stringify({
          sub: subject,
          role: claims.role,
          iat: issuedAt,
          exp: issuedAt + ttlSeconds,
        }),
      );
      const unsignedToken = `${HEADER}.${payload}`;
      return `${unsignedToken}.${sign(unsignedToken, normalizedSecret)}`;
    },

    verify: (token) => {
      const [header, payload, signature, ...rest] = token.split('.');
      if (
        header === undefined ||
        payload === undefined ||
        signature === undefined ||
        rest.length > 0
      ) {
        throw new Error('Invalid token format');
      }
      if (header !== HEADER) {
        throw new Error('Invalid token header');
      }

      const unsignedToken = `${header}.${payload}`;
      const expectedSignature = sign(unsignedToken, normalizedSecret);
      if (!safeEqual(signature, expectedSignature)) {
        throw new Error('Invalid token signature');
      }

      const claims = parsePayload(payload);
      const nowInSeconds = Math.floor(now() / 1000);
      if (claims.exp <= nowInSeconds) {
        throw new Error('Token expired');
      }
      return claims;
    },
  };
};

const parsePayload = (payload: string): VerifiedJwtClaims => {
  const raw = parseJson(decodeBase64Url(payload));
  if (typeof raw !== 'object' || raw === null) {
    throw new Error('Invalid token payload');
  }

  const sub = readString(raw, 'sub');
  const iat = readInteger(raw, 'iat');
  const exp = readInteger(raw, 'exp');
  if (exp <= iat) {
    throw new Error('Invalid token payload');
  }

  const role = readOptionalString(raw, 'role');
  return role === undefined ? { sub, iat, exp } : { sub, role, iat, exp };
};

const sign = (input: string, secret: string): string =>
  normalizeBase64Url(
    createHmac('sha256', secret).update(input).digest('base64'),
  );

const safeEqual = (left: string, right: string): boolean => {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return (
    leftBuffer.length === rightBuffer.length &&
    timingSafeEqual(leftBuffer, rightBuffer)
  );
};

const decodeBase64Url = (value: string): string => {
  const normalized = value.replaceAll('-', '+').replaceAll('_', '/');
  const padding = '='.repeat((4 - (normalized.length % 4)) % 4);
  return Buffer.from(`${normalized}${padding}`, 'base64').toString('utf8');
};

const parseJson = (value: string): unknown => {
  try {
    return JSON.parse(value);
  } catch {
    throw new Error('Invalid token payload');
  }
};

const readString = (source: object, key: string): string => {
  const value = Reflect.get(source, key);
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error('Invalid token payload');
  }
  return value;
};

const readOptionalString = (
  source: object,
  key: string,
): string | undefined => {
  const value = Reflect.get(source, key);
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error('Invalid token payload');
  }
  return value;
};

const readInteger = (source: object, key: string): number => {
  const value = Reflect.get(source, key);
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    throw new Error('Invalid token payload');
  }
  return value;
};
