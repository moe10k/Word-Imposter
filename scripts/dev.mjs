import { spawn } from 'node:child_process';
import path from 'node:path';

const DEFAULT_DEV_URL = 'http://127.0.0.1:3000';
const DEFAULT_TAB_COUNT = 4;
const STARTUP_MARKER = 'Server running on ';

function getDevUrl() {
  const appUrl = process.env.APP_URL?.trim();
  if (!appUrl) {
    return DEFAULT_DEV_URL;
  }

  try {
    const url = new URL(appUrl);
    if (url.protocol === 'http:' || url.protocol === 'https:') {
      return url.toString();
    }
  } catch {
    // Fall back to the local default when APP_URL is invalid for dev launching.
  }

  return DEFAULT_DEV_URL;
}

function getTabCount() {
  const value = Number(process.env.DEV_OPEN_TABS ?? DEFAULT_TAB_COUNT);
  if (!Number.isInteger(value) || value < 0) {
    return DEFAULT_TAB_COUNT;
  }
  return value;
}

function openUrl(url) {
  if (process.platform === 'win32') {
    spawn('cmd', ['/c', 'start', '', url], { stdio: 'ignore', detached: true });
    return;
  }

  if (process.platform === 'darwin') {
    spawn('open', [url], { stdio: 'ignore', detached: true });
    return;
  }

  spawn('xdg-open', [url], { stdio: 'ignore', detached: true });
}

function scheduleTabOpen(url, count) {
  for (let index = 0; index < count; index += 1) {
    setTimeout(() => openUrl(url), 250 * index);
  }
}

const localTsxCliPath = path.join(
  process.cwd(),
  'node_modules',
  'tsx',
  'dist',
  'cli.mjs'
);

const child = spawn(process.execPath, [localTsxCliPath, 'watch', 'server.ts'], {
  cwd: process.cwd(),
  env: process.env,
  stdio: ['inherit', 'pipe', 'pipe'],
});

const devUrl = getDevUrl();
const tabCount = getTabCount();
let didOpenTabs = false;

function forwardOutput(stream, writer) {
  stream.setEncoding('utf8');
  stream.on('data', chunk => {
    writer.write(chunk);

    if (!didOpenTabs && tabCount > 0 && chunk.includes(STARTUP_MARKER)) {
      didOpenTabs = true;
      scheduleTabOpen(devUrl, tabCount);
    }
  });
}

forwardOutput(child.stdout, process.stdout);
forwardOutput(child.stderr, process.stderr);

child.on('exit', code => {
  process.exit(code ?? 0);
});

process.on('SIGINT', () => {
  child.kill('SIGINT');
});

process.on('SIGTERM', () => {
  child.kill('SIGTERM');
});
