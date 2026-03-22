import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import type {
  AuthUserRecord,
  AuthStore,
  CreateSessionInput,
  CreateUserInput,
  SessionUserRecord,
} from '../server/auth/types.ts';
import { getSessionUser, loginUser, logoutUser, signupUser } from '../server/auth/service.ts';
import { hashPassword, verifyPassword } from '../server/auth/password.ts';
import { validateLoginInput, validateSignupInput } from '../server/auth/validation.ts';

class MemoryAuthStore implements AuthStore {
  users: AuthUserRecord[] = [];
  sessions: SessionUserRecord[] = [];

  async findUserByUsernameNormalized(usernameNormalized: string) {
    return this.users.find(user => user.usernameNormalized === usernameNormalized) ?? null;
  }

  async findUserByEmailNormalized(emailNormalized: string) {
    return this.users.find(user => user.emailNormalized === emailNormalized) ?? null;
  }

  async createUser(input: CreateUserInput) {
    const now = new Date();
    const user: AuthUserRecord = {
      id: this.users.length + 1,
      username: input.username,
      usernameNormalized: input.usernameNormalized,
      email: input.email,
      emailNormalized: input.emailNormalized,
      passwordHash: input.passwordHash,
      createdAt: now,
      updatedAt: now,
    };

    this.users.push(user);
    return user;
  }

  async createSession(input: CreateSessionInput) {
    const user = this.users.find(entry => entry.id === input.userId);
    if (!user) {
      throw new Error('User not found.');
    }

    this.sessions.push({
      id: this.sessions.length + 1,
      userId: input.userId,
      tokenHash: input.tokenHash,
      expiresAt: input.expiresAt,
      createdAt: new Date(),
      lastSeenAt: new Date(),
      user,
    });
  }

  async findSessionUserByTokenHash(tokenHash: string) {
    return this.sessions.find(session => session.tokenHash === tokenHash) ?? null;
  }

  async deleteSessionByTokenHash(tokenHash: string) {
    this.sessions = this.sessions.filter(session => session.tokenHash !== tokenHash);
  }

  async deleteExpiredSessions() {
    const now = Date.now();
    this.sessions = this.sessions.filter(session => session.expiresAt.getTime() > now);
  }
}

describe('password helpers', () => {
  it('hashes and verifies passwords', async () => {
    const password = 'correct horse battery staple';
    const hash = await hashPassword(password);

    assert.notEqual(hash, password);
    assert.equal(await verifyPassword(password, hash), true);
    assert.equal(await verifyPassword('wrong password', hash), false);
  });
});

describe('validation', () => {
  it('accepts valid signup payloads', () => {
    const result = validateSignupInput({
      username: 'Player_One',
      email: 'Player@example.com',
      password: 'hunter42!',
    });

    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.data.usernameNormalized, 'player_one');
      assert.equal(result.data.emailNormalized, 'player@example.com');
    }
  });

  it('rejects invalid login payloads', () => {
    const result = validateLoginInput({
      identifier: 'no',
      password: 'hunter42!',
    });

    assert.equal(result.ok, false);
  });
});

describe('auth service', () => {
  beforeEach(() => {
    process.env.SESSION_SECRET = 'test-session-secret';
    process.env.SESSION_TTL_DAYS = '7';
  });

  it('supports signup, login, session lookup, and logout', async () => {
    const store = new MemoryAuthStore();
    const signupResult = await signupUser(store, {
      username: 'Detective',
      email: 'detective@example.com',
      password: 'hunter42!',
    });

    assert.equal(signupResult.user.username, 'Detective');
    assert.equal(store.users.length, 1);

    const sessionUser = await getSessionUser(store, signupResult.session.signedToken);
    assert.ok(sessionUser);
    assert.equal(sessionUser?.email, 'detective@example.com');

    await logoutUser(store, signupResult.session.signedToken);
    assert.equal(await getSessionUser(store, signupResult.session.signedToken), null);

    const loginResult = await loginUser(store, {
      identifier: 'detective@example.com',
      password: 'hunter42!',
    });

    assert.equal(loginResult.user.username, 'Detective');
    assert.ok(await getSessionUser(store, loginResult.session.signedToken));
  });

  it('rejects duplicate usernames and emails', async () => {
    const store = new MemoryAuthStore();

    await signupUser(store, {
      username: 'Detective',
      email: 'detective@example.com',
      password: 'hunter42!',
    });

    await assert.rejects(
      () =>
        signupUser(store, {
          username: 'detective',
          email: 'another@example.com',
          password: 'hunter42!',
        }),
      /Username is already in use/
    );

    await assert.rejects(
      () =>
        signupUser(store, {
          username: 'AnotherOne',
          email: 'DETECTIVE@example.com',
          password: 'hunter42!',
        }),
      /Email is already in use/
    );
  });

  it('rejects invalid credentials', async () => {
    const store = new MemoryAuthStore();
    await signupUser(store, {
      username: 'Detective',
      email: 'detective@example.com',
      password: 'hunter42!',
    });

    await assert.rejects(
      () =>
        loginUser(store, {
          identifier: 'Detective',
          password: 'wrong-password',
        }),
      /Invalid credentials/
    );
  });
});
