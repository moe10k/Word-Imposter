import type { Express, Request, Response } from 'express';
import { getDevSessionTokenFromHeaders, loginAsDevUser } from './dev.ts';
import { clearSessionCookie, setSessionCookie } from './session.ts';
import {
  AuthServiceError,
  getSessionUser,
  getSessionUserFromCookieHeader,
  logoutUser,
  loginUser,
  logoutUserFromCookieHeader,
  signupUser,
} from './service.ts';
import type { AuthStore } from './types.ts';

function handleAuthError(response: Response, error: unknown, context: string) {
  if (error instanceof AuthServiceError) {
    response.status(error.statusCode).json({ error: error.message });
    return;
  }

  console.error(`${context} failed:`, error);
  response.status(500).json({ error: 'Internal server error.' });
}

async function getRequestUser(store: AuthStore, request: Request) {
  const devSessionToken = getDevSessionTokenFromHeaders(request.headers);
  if (devSessionToken) {
    return getSessionUser(store, devSessionToken);
  }

  return getSessionUserFromCookieHeader(store, request.headers.cookie);
}

async function logoutRequestUser(store: AuthStore, request: Request) {
  const devSessionToken = getDevSessionTokenFromHeaders(request.headers);
  if (devSessionToken) {
    await logoutUser(store, devSessionToken);
    return;
  }

  await logoutUserFromCookieHeader(store, request.headers.cookie);
}

export function registerAuthRoutes(app: Express, store: AuthStore) {
  app.get('/api/auth/session', async (request, response) => {
    try {
      const user = await getRequestUser(store, request);
      response.json({ user });
    } catch (error) {
      handleAuthError(response, error, 'Session lookup');
    }
  });

  app.post('/api/auth/signup', async (request, response) => {
    try {
      const result = await signupUser(store, request.body);
      setSessionCookie(response, result.session.signedToken, result.session.expiresAt);
      response.status(201).json({ user: result.user });
    } catch (error) {
      handleAuthError(response, error, 'Signup');
    }
  });

  app.post('/api/auth/login', async (request, response) => {
    try {
      const result = await loginUser(store, request.body);
      setSessionCookie(response, result.session.signedToken, result.session.expiresAt);
      response.json({ user: result.user });
    } catch (error) {
      handleAuthError(response, error, 'Login');
    }
  });

  app.post('/api/auth/logout', async (request, response) => {
    try {
      await logoutRequestUser(store, request);
    } catch (error) {
      console.error('Logout failed:', error);
    } finally {
      clearSessionCookie(response);
      response.status(204).send();
    }
  });

  app.post('/api/dev/login-as', async (request, response) => {
    if ((process.env.NODE_ENV ?? 'development') === 'production') {
      response.status(404).json({ error: 'Not found.' });
      return;
    }

    try {
      const slot = typeof request.body?.slot === 'number' ? request.body.slot : Number(request.body?.slot);
      const result = await loginAsDevUser(store, slot);
      if (!result) {
        response.status(400).json({ error: 'Choose a dev player between 1 and 4.' });
        return;
      }

      response.json({
        user: result.user,
        devSessionToken: result.devSessionToken,
      });
    } catch (error) {
      handleAuthError(response, error, 'Dev login');
    }
  });
}
