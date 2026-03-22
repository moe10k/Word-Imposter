import type { Express, Response } from 'express';
import { clearSessionCookie, setSessionCookie } from './session.ts';
import {
  AuthServiceError,
  getSessionUserFromCookieHeader,
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

export function registerAuthRoutes(app: Express, store: AuthStore) {
  app.get('/api/auth/session', async (request, response) => {
    try {
      const user = await getSessionUserFromCookieHeader(store, request.headers.cookie);
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
      await logoutUserFromCookieHeader(store, request.headers.cookie);
    } catch (error) {
      console.error('Logout failed:', error);
    } finally {
      clearSessionCookie(response);
      response.status(204).send();
    }
  });
}
