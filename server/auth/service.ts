import type { AuthUser } from '../../src/types.ts';
import { hashPassword, verifyPassword } from './password.ts';
import {
  createSessionToken,
  createSignedSessionToken,
  getSessionTtlMs,
  getSignedSessionTokenFromCookieHeader,
  hashSessionToken,
  verifySignedSessionToken,
} from './session.ts';
import type { AuthResult, AuthStore, AuthUserRecord, SessionPayload } from './types.ts';
import { validateLoginInput, validateSignupInput } from './validation.ts';

export class AuthServiceError extends Error {
  statusCode: number;

  constructor(statusCode: number, message: string) {
    super(message);
    this.statusCode = statusCode;
  }
}

export function toPublicUser(user: AuthUserRecord): AuthUser {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    createdAt: user.createdAt.toISOString(),
  };
}

function isDuplicateEntryError(error: unknown) {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: string }).code === 'ER_DUP_ENTRY'
  );
}

export async function issueSessionForUser(store: AuthStore, userId: number): Promise<SessionPayload> {
  const token = createSessionToken();
  const expiresAt = new Date(Date.now() + getSessionTtlMs());

  await store.createSession({
    userId,
    tokenHash: hashSessionToken(token),
    expiresAt,
  });

  return {
    signedToken: createSignedSessionToken(token),
    expiresAt,
  };
}

export async function signupUser(store: AuthStore, payload: unknown): Promise<AuthResult> {
  const validation = validateSignupInput(payload);
  if (validation.ok === false) {
    throw new AuthServiceError(400, validation.error);
  }

  await store.deleteExpiredSessions();

  const { data } = validation;
  const existingUsername = await store.findUserByUsernameNormalized(data.usernameNormalized);
  if (existingUsername) {
    throw new AuthServiceError(409, 'Username is already in use.');
  }

  const existingEmail = await store.findUserByEmailNormalized(data.emailNormalized);
  if (existingEmail) {
    throw new AuthServiceError(409, 'Email is already in use.');
  }

  const passwordHash = await hashPassword(data.password);

  try {
    const user = await store.createUser({
      username: data.username,
      usernameNormalized: data.usernameNormalized,
      email: data.email,
      emailNormalized: data.emailNormalized,
      passwordHash,
    });

    return {
      user: toPublicUser(user),
      session: await issueSessionForUser(store, user.id),
    };
  } catch (error) {
    if (isDuplicateEntryError(error)) {
      throw new AuthServiceError(409, 'Username or email is already in use.');
    }
    throw error;
  }
}

export async function loginUser(store: AuthStore, payload: unknown): Promise<AuthResult> {
  const validation = validateLoginInput(payload);
  if (validation.ok === false) {
    throw new AuthServiceError(400, validation.error);
  }

  await store.deleteExpiredSessions();

  const { data } = validation;
  const user =
    data.identifierType === 'email'
      ? await store.findUserByEmailNormalized(data.identifierNormalized)
      : await store.findUserByUsernameNormalized(data.identifierNormalized);

  if (!user) {
    throw new AuthServiceError(401, 'Invalid credentials.');
  }

  const passwordMatches = await verifyPassword(data.password, user.passwordHash);
  if (!passwordMatches) {
    throw new AuthServiceError(401, 'Invalid credentials.');
  }

  return {
    user: toPublicUser(user),
    session: await issueSessionForUser(store, user.id),
  };
}

export async function getSessionUser(store: AuthStore, signedToken: string | null | undefined) {
  await store.deleteExpiredSessions();

  const token = verifySignedSessionToken(signedToken);
  if (!token) {
    return null;
  }

  const session = await store.findSessionUserByTokenHash(hashSessionToken(token));
  if (!session) {
    return null;
  }

  if (session.expiresAt.getTime() <= Date.now()) {
    await store.deleteSessionByTokenHash(session.tokenHash);
    return null;
  }

  return toPublicUser(session.user);
}

export function getSessionUserFromCookieHeader(store: AuthStore, cookieHeader: string | undefined) {
  return getSessionUser(store, getSignedSessionTokenFromCookieHeader(cookieHeader));
}

export async function logoutUser(store: AuthStore, signedToken: string | null | undefined) {
  const token = verifySignedSessionToken(signedToken);
  if (!token) {
    return;
  }

  await store.deleteSessionByTokenHash(hashSessionToken(token));
}

export function logoutUserFromCookieHeader(store: AuthStore, cookieHeader: string | undefined) {
  return logoutUser(store, getSignedSessionTokenFromCookieHeader(cookieHeader));
}
