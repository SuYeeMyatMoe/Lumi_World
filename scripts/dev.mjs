import { execSync, spawn } from 'node:child_process';
import { rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const vite = path.join(root, 'node_modules', 'vite', 'bin', 'vite.js');

function freePort(port) {
  try {
    const out = execSync(`netstat -ano`, { encoding: 'utf8' });
    const pids = new Set();
    for (const line of out.split(/\r?\n/)) {
      if (!line.includes(`:${port} `) && !line.includes(`:${port}\t`)) continue;
      if (!/LISTENING/i.test(line)) continue;
      const pid = line.trim().split(/\s+/).pop();
      if (pid && pid !== '0' && pid !== String(process.pid)) pids.add(pid);
    }
    for (const pid of pids) {
      try {
        execSync(process.platform === 'win32' ? `taskkill /F /PID ${pid}` : `kill ${pid}`);
      } catch {
        /* already gone */
      }
    }
  } catch {
    /* netstat unavailable */
  }
}

freePort(5173);

// Clean dist once per dev session. vite.config.ts sets emptyOutDir:false for
// --watch so Chrome never sees the unpacked extension vanish mid-rebuild; this
// keeps that from leaving stale output behind (e.g. vendor/crx-client-port.js
// from an older CRXJS dev-server run, which throws "disconnected port object").
rmSync(path.join(root, 'dist'), { recursive: true, force: true });

const children = [
  spawn(process.execPath, [vite, 'build', '--watch'], {
    cwd: root,
    stdio: 'inherit',
  }),
  spawn(process.execPath, [vite, '--config', 'vite.demo.config.ts'], {
    cwd: root,
    stdio: 'inherit',
  }),
];

function shutdown() {
  for (const child of children) {
    if (!child.killed) child.kill();
  }
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
