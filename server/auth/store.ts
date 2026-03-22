import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import type { Pool } from 'mysql2/promise';
import type {
  AuthStore,
  AuthUserRecord,
  CreateSessionInput,
  CreateUserInput,
  SessionUserRecord,
} from './types.ts';

type UserRow = RowDataPacket & {
  id: number;
  username: string;
  username_normalized: string;
  email: string;
  email_normalized: string;
  password_hash: string;
  created_at: Date;
  updated_at: Date;
};

type SessionUserRow = RowDataPacket & {
  session_id: number;
  session_user_id: number;
  token_hash: string;
  expires_at: Date;
  session_created_at: Date;
  last_seen_at: Date;
  user_id: number;
  username: string;
  username_normalized: string;
  email: string;
  email_normalized: string;
  password_hash: string;
  user_created_at: Date;
  user_updated_at: Date;
};

function mapUserRow(row: UserRow): AuthUserRecord {
  return {
    id: row.id,
    username: row.username,
    usernameNormalized: row.username_normalized,
    email: row.email,
    emailNormalized: row.email_normalized,
    passwordHash: row.password_hash,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

export function createMySqlAuthStore(pool: Pool): AuthStore {
  const findUserBy = async (field: 'username_normalized' | 'email_normalized', value: string) => {
    const [rows] = await pool.query<UserRow[]>(
      `SELECT id, username, username_normalized, email, email_normalized, password_hash, created_at, updated_at
       FROM users
       WHERE ${field} = ?
       LIMIT 1`,
      [value]
    );

    return rows[0] ? mapUserRow(rows[0]) : null;
  };

  return {
    findUserByUsernameNormalized(usernameNormalized: string) {
      return findUserBy('username_normalized', usernameNormalized);
    },

    findUserByEmailNormalized(emailNormalized: string) {
      return findUserBy('email_normalized', emailNormalized);
    },

    async createUser(input: CreateUserInput) {
      const [result] = await pool.execute<ResultSetHeader>(
        `INSERT INTO users (username, username_normalized, email, email_normalized, password_hash)
         VALUES (?, ?, ?, ?, ?)`,
        [
          input.username,
          input.usernameNormalized,
          input.email,
          input.emailNormalized,
          input.passwordHash,
        ]
      );

      return {
        id: Number(result.insertId),
        username: input.username,
        usernameNormalized: input.usernameNormalized,
        email: input.email,
        emailNormalized: input.emailNormalized,
        passwordHash: input.passwordHash,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    },

    async createSession(input: CreateSessionInput) {
      await pool.execute(
        `INSERT INTO user_sessions (user_id, token_hash, expires_at)
         VALUES (?, ?, ?)`,
        [input.userId, input.tokenHash, input.expiresAt]
      );
    },

    async findSessionUserByTokenHash(tokenHash: string) {
      const [rows] = await pool.query<SessionUserRow[]>(
        `SELECT
           s.id AS session_id,
           s.user_id AS session_user_id,
           s.token_hash,
           s.expires_at,
           s.created_at AS session_created_at,
           s.last_seen_at,
           u.id AS user_id,
           u.username,
           u.username_normalized,
           u.email,
           u.email_normalized,
           u.password_hash,
           u.created_at AS user_created_at,
           u.updated_at AS user_updated_at
         FROM user_sessions s
         INNER JOIN users u ON u.id = s.user_id
         WHERE s.token_hash = ?
         LIMIT 1`,
        [tokenHash]
      );

      const row = rows[0];
      if (!row) {
        return null;
      }

      await pool.execute(
        `UPDATE user_sessions
         SET last_seen_at = CURRENT_TIMESTAMP
         WHERE token_hash = ?`,
        [tokenHash]
      );

      const user: AuthUserRecord = {
        id: row.user_id,
        username: row.username,
        usernameNormalized: row.username_normalized,
        email: row.email,
        emailNormalized: row.email_normalized,
        passwordHash: row.password_hash,
        createdAt: new Date(row.user_created_at),
        updatedAt: new Date(row.user_updated_at),
      };

      return {
        id: row.session_id,
        userId: row.session_user_id,
        tokenHash: row.token_hash,
        expiresAt: new Date(row.expires_at),
        createdAt: new Date(row.session_created_at),
        lastSeenAt: new Date(row.last_seen_at),
        user,
      } satisfies SessionUserRecord;
    },

    async deleteSessionByTokenHash(tokenHash: string) {
      await pool.execute(
        `DELETE FROM user_sessions
         WHERE token_hash = ?`,
        [tokenHash]
      );
    },

    async deleteExpiredSessions() {
      await pool.execute(
        `DELETE FROM user_sessions
         WHERE expires_at <= CURRENT_TIMESTAMP`
      );
    },
  };
}
