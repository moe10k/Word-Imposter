import type { Response } from 'express';
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'crypto';

const DEFAULT_SESSION_COOKIE_NAME = 'word_imposter_session';
const DEFAULT_SESSION_TTL_DAYS = 7;

export function getSessionSecret() {
  const secret = process.env.SESSION_SECRET?.trim();
  if (!secret) {
    throw new Error('SESSION_SECRET is not set. Add it to your environment before starting the server.');
  }
  return secret;
}

export function getSessionCookieName() {
  return process.env.AUTH_COOKIE_NAME?.trim() || DEFAULT_SESSION_COOKIE_NAME;
}

export function getSessionTtlMs() {
  const ttlDays = Number(process.env.SESSION_TTL_DAYS ?? DEFAULT_SESSION_TTL_DAYS);
  const safeTtlDays = Number.isFinite(ttlDays) && ttlDays > 0 ? ttlDays : DEFAULT_SESSION_TTL_DAYS;
  return safeTtlDays * 24 * 60 * 60 * 1000;
}

export function createSessionToken() {
  return randomBytes(32).toString('hex');
}

export function hashSessionToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

function signSessionToken(token: string) {
  return createHmac('sha256', getSessionSecret()).update(token).digest('hex');
}

export function createSignedSessionToken(token: string) {
  return `${token}.${signSessionToken(token)}`;
}

export function verifySignedSessionToken(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const [token, signature, ...rest] = value.split('.');
  if (!token || !signature || rest.length > 0) {
    return null;
  }
  if (!/^[a-f0-9]+$/i.test(signature)) {
    return null;
  }

  const expectedSignature = Buffer.from(signSessionToken(token), 'hex');
  const actualSignature = Buffer.from(signature, 'hex');
  if (expectedSignature.length !== actualSignature.length) {
    return null;
  }

  return timingSafeEqual(expectedSignature, actualSignature) ? token : null;
}

export function getCookieValue(cookieHeader: string | undefined, cookieName: string) {
  if (!cookieHeader) {
    return null;
  }

  const pairs = cookieHeader.split(';');
  for (const pair of pairs) {
    const separatorIndex = pair.indexOf('=');
    if (separatorIndex === -1) {
      continue;
    }

    const key = pair.slice(0, separatorIndex).trim();
    if (key !== cookieName) {
      continue;
    }

    try {
      return decodeURIComponent(pair.slice(separatorIndex + 1).trim());
    } catch {
      return null;
    }
  }

  return null;
}

export function getSignedSessionTokenFromCookieHeader(cookieHeader: string | undefined) {
  return getCookieValue(cookieHeader, getSessionCookieName());
}

export function setSessionCookie(response: Response, signedToken: string, expiresAt: Date) {
  response.cookie(getSessionCookieName(), signedToken, {
    expires: expiresAt,
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
  });
}

export function clearSessionCookie(response: Response) {
  response.clearCookie(getSessionCookieName(), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
  });
}
