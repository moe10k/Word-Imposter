import type { IncomingHttpHeaders } from 'http';
import type { AuthResult, AuthStore } from './types.ts';
import { hashPassword } from './password.ts';
import { issueSessionForUser, toPublicUser } from './service.ts';

export const DEV_SESSION_HEADER_NAME = 'x-word-imposter-dev-session';

type DevUserDefinition = {
  username: string;
  email: string;
  password: string;
};

function isDevelopmentAuthEnabled() {
  return (process.env.NODE_ENV ?? 'development') !== 'production';
}

function getDevUserDefinition(slot: number): DevUserDefinition | null {
  if (!Number.isInteger(slot) || slot < 1 || slot > 4) {
    return null;
  }

  return {
    username: `DevPlayer${slot}`,
    email: `devplayer${slot}@example.test`,
    password: `dev-player-${slot}-password`,
  };
}

function getHeaderValue(headers: IncomingHttpHeaders, headerName: string) {
  const value = headers[headerName];
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }
  return typeof value === 'string' ? value : null;
}

export function getDevSessionTokenFromHeaders(headers: IncomingHttpHeaders) {
  if (!isDevelopmentAuthEnabled()) {
    return null;
  }

  return getHeaderValue(headers, DEV_SESSION_HEADER_NAME) ?? null;
}

export function getDevSessionTokenFromSocketAuth(auth: unknown) {
  if (!isDevelopmentAuthEnabled()) {
    return null;
  }

  if (typeof auth !== 'object' || auth === null) {
    return null;
  }

  const token = 'devSessionToken' in auth ? auth.devSessionToken : null;
  return typeof token === 'string' && token ? token : null;
}

export async function loginAsDevUser(store: AuthStore, slot: number): Promise<(AuthResult & { devSessionToken: string }) | null> {
  if (!isDevelopmentAuthEnabled()) {
    return null;
  }

  const definition = getDevUserDefinition(slot);
  if (!definition) {
    return null;
  }

  await store.deleteExpiredSessions();

  let user = await store.findUserByUsernameNormalized(definition.username.toLowerCase());
  if (!user) {
    user = await store.findUserByEmailNormalized(definition.email.toLowerCase());
  }

  if (!user) {
    user = await store.createUser({
      username: definition.username,
      usernameNormalized: definition.username.toLowerCase(),
      email: definition.email,
      emailNormalized: definition.email.toLowerCase(),
      passwordHash: await hashPassword(definition.password),
    });
  }

  const session = await issueSessionForUser(store, user.id);
  return {
    user: toPublicUser(user),
    session,
    devSessionToken: session.signedToken,
  };
}
