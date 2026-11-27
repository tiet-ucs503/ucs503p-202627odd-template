import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { spawn, type ChildProcess } from 'child_process';

const ROOT = process.cwd();
const TEST_PORT = process.env.TEST_PORT || '3100';
const BASE_URL = process.env.BASE_URL || `http://127.0.0.1:${TEST_PORT}`;
const TEST_STATE_PATH = path.join(os.tmpdir(), `intellischedule-test-${process.pid}.json`);
let ownedServer: ChildProcess | null = null;

const randomTestPassword = () => crypto.randomBytes(24).toString('base64url') + 'A1!';
async function isServerReady(): Promise<boolean> {
  try {
    const response = await fetch(BASE_URL + '/api/health/live');
    if (!response.ok) return false;
    const body = await response.json().catch(() => null);
    return body?.status === 'LIVE';
  } catch {
    return false;
  }
}

async function waitForServer(timeoutMs = 30000): Promise<void> {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (await isServerReady()) return;
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  throw new Error(`Timed out waiting for the local test server on port ${TEST_PORT}.`);
}

function startServer(testPassword: string): ChildProcess {
  // Launch the server in this process tree so it can be stopped cleanly.
  const child = spawn(process.execPath, ['--import', 'tsx', 'server.ts'], {
    cwd: ROOT,
    env: { ...process.env, NODE_ENV: 'test', PORT: TEST_PORT, BASE_URL, PERSISTENT_STATE_PATH: TEST_STATE_PATH, ALLOW_TEST_RESET_TOKEN: 'true', PUBLIC_DEMO_ENABLED: 'true', SEED_USER_PASSWORD: testPassword, DEMO_ACCOUNT_PASSWORD: testPassword },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout?.on('data', chunk => process.stdout.write('[test-server] ' + chunk));
  child.stderr?.on('data', chunk => process.stderr.write('[test-server] ' + chunk));
  return child;
}

function stopServer(): Promise<void> {
  return new Promise(resolve => {
    if (!ownedServer || ownedServer.exitCode !== null) return resolve();
    const child = ownedServer;
    const timer = setTimeout(() => { child.kill('SIGKILL'); resolve(); }, 5000);
    child.once('exit', () => { clearTimeout(timer); resolve(); });
    child.kill('SIGTERM');
  });
}

async function runCommand(args: string[], env?: NodeJS.ProcessEnv): Promise<number> {
  return new Promise(resolve => {
    const child = spawn(process.execPath, ['--import', 'tsx', ...args], {
      cwd: ROOT,
      env: env ? { ...process.env, ...env } : process.env,
      stdio: 'inherit',
    });
    child.once('error', err => { console.error('Failed to start test command:', err); resolve(1); });
    child.once('exit', code => resolve(code ?? 1));
  });
}

async function main(): Promise<void> {
  const testDir = path.join(ROOT, 'tests');
  const testFiles = fs.readdirSync(testDir)
    .filter(name => name.endsWith('.test.ts'))
    .sort()
    .map(name => path.join('tests', name));

  const testPassword = process.env.SEED_USER_PASSWORD || process.env.DEMO_ACCOUNT_PASSWORD || randomTestPassword();

  try {
    if (await isServerReady()) {
      // Server already running on test port
    } else {
      ownedServer = startServer(testPassword);
      await waitForServer();
    }

    const testEnv = { NODE_ENV: 'test', PORT: TEST_PORT, BASE_URL, PERSISTENT_STATE_PATH: TEST_STATE_PATH, ALLOW_TEST_RESET_TOKEN: 'true', PUBLIC_DEMO_ENABLED: 'true', SEED_USER_PASSWORD: testPassword, DEMO_ACCOUNT_PASSWORD: testPassword };
    const unitExit = await runCommand(['--test', '--test-concurrency=1', ...testFiles], testEnv);
    if (unitExit !== 0) {
      process.exitCode = unitExit;
      return;
    }

    process.exitCode = await runCommand(['scripts/run_e2e_tests.ts'], testEnv);
  } finally {
    await stopServer();
    ownedServer = null;
    try { fs.rmSync(TEST_STATE_PATH, { force: true }); } catch {}
  }
}

main().catch(async err => {
  console.error(err);
  await stopServer();
  process.exit(1);
});
