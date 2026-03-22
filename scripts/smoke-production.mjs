import { spawn } from 'node:child_process';

const READY_PATTERN = /Server running on (http:\/\/[^\s]+)/;
const START_TIMEOUT_MS = 20_000;

function waitForServer(child) {
  return new Promise((resolve, reject) => {
    let output = '';
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error('Timed out waiting for compiled production server to start.'));
    }, START_TIMEOUT_MS);

    const onData = chunk => {
      output += chunk.toString();
      const match = output.match(READY_PATTERN);
      if (!match) {
        return;
      }

      cleanup();
      resolve(match[1]);
    };

    const onExit = code => {
      cleanup();
      reject(
        new Error(
          `Compiled production server exited before it was ready (code ${code ?? 'unknown'}).`
        )
      );
    };

    const cleanup = () => {
      clearTimeout(timeout);
      child.stdout.off('data', onData);
      child.stderr.off('data', onData);
      child.off('exit', onExit);
    };

    child.stdout.on('data', onData);
    child.stderr.on('data', onData);
    child.on('exit', onExit);
  });
}

async function main() {
  const child = spawn(process.execPath, ['build/server.js'], {
    cwd: process.cwd(),
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env,
      NODE_ENV: 'production',
      PORT: '0',
      APP_URL: 'https://example.com',
      SESSION_SECRET: 'smoke-session-secret',
      DB_HOST: '127.0.0.1',
      DB_PORT: '3306',
      DB_NAME: 'word_imposter_smoke',
      DB_USER: 'smoke_user',
      DB_PASSWORD: '',
    },
  });

  try {
    const serverUrl = await waitForServer(child);
    const response = await fetch(serverUrl);
    const html = await response.text();

    if (!response.ok) {
      throw new Error(
        `Expected HTTP 200 from compiled production server, received ${response.status}.`
      );
    }

    if (!html.includes('Word Imposter')) {
      throw new Error('Compiled production server did not return the built app shell.');
    }
  } finally {
    child.kill('SIGTERM');
    await new Promise(resolve => child.once('exit', resolve));
  }
}

main().catch(error => {
  console.error('Production smoke test failed:', error);
  process.exitCode = 1;
});
