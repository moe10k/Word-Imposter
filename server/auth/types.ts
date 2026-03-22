import type { AuthUser } from '../../src/types.ts';

export interface AuthUserRecord {
  id: number;
  username: string;
  usernameNormalized: string;
  email: string;
  emailNormalized: string;
  passwordHash: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuthSessionRecord {
  id: number;
  userId: number;
  tokenHash: string;
  expiresAt: Date;
  createdAt: Date;
  lastSeenAt: Date;
}

export interface SessionUserRecord extends AuthSessionRecord {
  user: AuthUserRecord;
}

export interface CreateUserInput {
  username: string;
  usernameNormalized: string;
  email: string;
  emailNormalized: string;
  passwordHash: string;
}

export interface CreateSessionInput {
  userId: number;
  tokenHash: string;
  expiresAt: Date;
}

export interface SessionPayload {
  signedToken: string;
  expiresAt: Date;
}

export interface AuthResult {
  user: AuthUser;
  session: SessionPayload;
}

export interface AuthStore {
  findUserByUsernameNormalized(usernameNormalized: string): Promise<AuthUserRecord | null>;
  findUserByEmailNormalized(emailNormalized: string): Promise<AuthUserRecord | null>;
  createUser(input: CreateUserInput): Promise<AuthUserRecord>;
  createSession(input: CreateSessionInput): Promise<void>;
  findSessionUserByTokenHash(tokenHash: string): Promise<SessionUserRecord | null>;
  deleteSessionByTokenHash(tokenHash: string): Promise<void>;
  deleteExpiredSessions(): Promise<void>;
}
