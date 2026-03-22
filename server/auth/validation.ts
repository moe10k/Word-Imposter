type ValidationResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

const USERNAME_PATTERN = /^[A-Za-z0-9_]{3,20}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 72;

export interface SignupInput {
  username: string;
  usernameNormalized: string;
  email: string;
  emailNormalized: string;
  password: string;
}

export interface LoginInput {
  identifier: string;
  identifierNormalized: string;
  identifierType: 'username' | 'email';
  password: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function normalizeUsername(username: string) {
  return username.trim().toLowerCase();
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function validateSignupInput(payload: unknown): ValidationResult<SignupInput> {
  if (!isRecord(payload)) {
    return { ok: false, error: 'Invalid request body.' };
  }

  const username = typeof payload.username === 'string' ? payload.username.trim() : '';
  const email = typeof payload.email === 'string' ? payload.email.trim() : '';
  const password = typeof payload.password === 'string' ? payload.password : '';

  if (!USERNAME_PATTERN.test(username)) {
    return {
      ok: false,
      error: 'Username must be 3-20 characters and contain only letters, numbers, or underscores.',
    };
  }

  if (!EMAIL_PATTERN.test(email) || email.length > 255) {
    return { ok: false, error: 'Enter a valid email address.' };
  }

  if (password.length < MIN_PASSWORD_LENGTH || password.length > MAX_PASSWORD_LENGTH) {
    return {
      ok: false,
      error: `Password must be ${MIN_PASSWORD_LENGTH}-${MAX_PASSWORD_LENGTH} characters long.`,
    };
  }

  return {
    ok: true,
    data: {
      username,
      usernameNormalized: normalizeUsername(username),
      email,
      emailNormalized: normalizeEmail(email),
      password,
    },
  };
}

export function validateLoginInput(payload: unknown): ValidationResult<LoginInput> {
  if (!isRecord(payload)) {
    return { ok: false, error: 'Invalid request body.' };
  }

  const identifier = typeof payload.identifier === 'string' ? payload.identifier.trim() : '';
  const password = typeof payload.password === 'string' ? payload.password : '';

  if (!identifier) {
    return { ok: false, error: 'Username or email is required.' };
  }

  if (!password || password.length > MAX_PASSWORD_LENGTH) {
    return { ok: false, error: 'Invalid credentials.' };
  }

  const identifierType = identifier.includes('@') ? 'email' : 'username';
  if (identifierType === 'email') {
    if (!EMAIL_PATTERN.test(identifier) || identifier.length > 255) {
      return { ok: false, error: 'Enter a valid email address.' };
    }
  } else if (!USERNAME_PATTERN.test(identifier)) {
    return {
      ok: false,
      error: 'Username must be 3-20 characters and contain only letters, numbers, or underscores.',
    };
  }

  return {
    ok: true,
    data: {
      identifier,
      identifierNormalized:
        identifierType === 'email' ? normalizeEmail(identifier) : normalizeUsername(identifier),
      identifierType,
      password,
    },
  };
}
