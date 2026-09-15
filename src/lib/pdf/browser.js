import { mkdtemp, readdir, readlink, rm, stat, writeFile, readFile } from 'node:fs/promises';
import { rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import puppeteerCore from 'puppeteer-core';

// Must match the @sparticuz/chromium-min major version in package.json.
const REMOTE_CHROMIUM_PACK = 'https://github.com/Sparticuz/chromium/releases/download/v133.0.0/chromium-v133.0.0-pack.tar';

const COMMON_ARGS = ['--no-sandbox', '--disable-setuid-sandbox', '--font-render-hinting=none', '--disable-dev-shm-usage'];

/**
 * Temp-file hygiene.
 *
 * Every launch gets a throw-away profile directory (`<tmp>/markdown-studio-chrome-XXXXXX`) that
 * holds the cache, cookies, blob storage, crash dumps and so on. Chromium additionally creates a
 * second directory in the temp folder for its process-singleton socket (`com.google.Chrome.XXXXXX`
 * on macOS, `.org.chromium.Chromium.XXXXXX` / `scoped_dirXXXXXX` on Linux) and points
 * `<profile>/SingletonSocket` at it with a symlink. Chromium only deletes that directory on a
 * graceful shutdown, so a killed dev server, a render timeout or a SIGINT leaves it behind — and
 * Puppeteer never touches it because it is not the profile directory.
 *
 * `withBrowser` therefore records both paths right after launch, removes them after the browser
 * has exited (falling back to SIGKILL if the graceful close hangs), removes whatever is still
 * live when the Node process exits, and sweeps orphans from earlier crashed processes on the next
 * launch. Orphaned singleton directories are recognised by a marker file we drop into them, and
 * only removed once the Chromium process that owned them is gone.
 */
const PROFILE_PREFIX = 'markdown-studio-chrome-';
const MARKER_FILE = '.markdown-studio';
const SINGLETON_DIR_PATTERN = /^(com\.google\.Chrome\.|\.org\.chromium\.Chromium\.|\.com\.google\.Chrome\.|scoped_dir)/;
const STALE_AFTER_MS = 10 * 60 * 1000;
const CLOSE_TIMEOUT_MS = 8_000;
const RM_OPTIONS = { recursive: true, force: true, maxRetries: 3, retryDelay: 100 };

// Survives Next.js HMR module re-evaluation, so the exit hook is registered exactly once and the
// live-session set is shared across module instances.
const STATE_KEY = Symbol.for('markdown-studio.chromium-sessions');
/** @type {{ live: Set<string>, hooked: boolean, sweptAt: number }} */
const state = (globalThis[STATE_KEY] ??= { live: new Set(), hooked: false, sweptAt: 0 });

function installExitHook() {
  if (state.hooked) return;
  state.hooked = true;
  // Puppeteer's own SIGINT/SIGTERM/SIGHUP handlers kill the browser and call process.exit(), which
  // fires 'exit'; only synchronous work is possible here.
  process.once('exit', () => {
    for (const dir of state.live) {
      try {
        rmSync(dir, RM_OPTIONS);
      } catch {
        /* best effort */
      }
    }
    state.live.clear();
  });
}

function isInsideTmp(p) {
  const tmp = path.resolve(os.tmpdir()) + path.sep;
  const resolved = path.resolve(p);
  return resolved.startsWith(tmp) && resolved.length > tmp.length;
}

function pidAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    return err.code === 'EPERM';
  }
}

/** Resolve Chromium's singleton socket directory for a profile, or null when there is none. */
async function singletonSocketDir(profileDir) {
  try {
    const target = await readlink(path.join(profileDir, 'SingletonSocket'));
    const dir = path.dirname(path.resolve(profileDir, target));
    return isInsideTmp(dir) && SINGLETON_DIR_PATTERN.test(path.basename(dir)) ? dir : null;
  } catch {
    return null;
  }
}

async function removeDir(dir) {
  if (!dir || !isInsideTmp(dir)) return;
  try {
    await rm(dir, RM_OPTIONS);
  } catch (err) {
    console.warn(`[browser] could not remove ${dir}: ${err.message}`);
  }
}

/**
 * Remove leftovers from earlier processes that did not get to clean up: our profile directories
 * and singleton-socket directories carrying our marker whose Chromium process is gone. Runs at
 * most once every STALE_AFTER_MS so it costs nothing on busy servers.
 */
async function sweepOrphans() {
  const now = Date.now();
  if (now - state.sweptAt < STALE_AFTER_MS) return;
  state.sweptAt = now;

  const tmp = os.tmpdir();
  let entries;
  try {
    entries = await readdir(tmp, { withFileTypes: true });
  } catch {
    return;
  }

  await Promise.all(
    entries.map(async (entry) => {
      if (!entry.isDirectory()) return;
      const full = path.join(tmp, entry.name);
      if (state.live.has(full)) return;

      if (entry.name.startsWith(PROFILE_PREFIX)) {
        const info = await stat(full).catch(() => null);
        if (info && now - info.mtimeMs > STALE_AFTER_MS) await removeDir(full);
        return;
      }

      if (SINGLETON_DIR_PATTERN.test(entry.name)) {
        const marker = await readFile(path.join(full, MARKER_FILE), 'utf8').catch(() => null);
        if (marker === null) return; // not ours — may belong to the user's running Chrome
        let pid;
        try {
          pid = JSON.parse(marker).pid;
        } catch {
          pid = null;
        }
        if (!pidAlive(pid)) await removeDir(full);
      }
    }),
  );
}

async function launchServerless(userDataDir) {
  const chromium = (await import('@sparticuz/chromium-min')).default;
  const executablePath = await chromium.executablePath(REMOTE_CHROMIUM_PACK);
  return puppeteerCore.launch({
    executablePath,
    args: [...chromium.args, ...COMMON_ARGS],
    headless: true,
    userDataDir,
    defaultViewport: { width: 1280, height: 1024 },
  });
}

/**
 * Launch Chromium. On Vercel (or when PUPPETEER_EXECUTABLE_PATH is unset and
 * no local Chrome is found) the serverless chromium pack is used; locally we
 * prefer an installed Chrome so `npm run dev` works with zero setup.
 *
 * Prefer {@link withBrowser}, which also guarantees the temp directories are removed.
 * @param {{ userDataDir?: string }} [options]
 */
export async function launchBrowser({ userDataDir } = {}) {
  if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
    return launchServerless(userDataDir);
  }

  if (process.env.PUPPETEER_EXECUTABLE_PATH) {
    return puppeteerCore.launch({ executablePath: process.env.PUPPETEER_EXECUTABLE_PATH, args: COMMON_ARGS, headless: true, userDataDir });
  }

  for (const channel of ['chrome', 'chrome-canary', 'chrome-beta']) {
    try {
      return await puppeteerCore.launch({ channel, args: COMMON_ARGS, headless: true, userDataDir });
    } catch {
      /* try next */
    }
  }

  return launchServerless(userDataDir);
}

/** Close gracefully; if Chromium does not exit in time, kill it so the directories can be removed. */
async function closeBrowser(browser) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error('browser.close timed out')), CLOSE_TIMEOUT_MS);
  });
  try {
    await Promise.race([browser.close(), timeout]);
  } catch {
    try {
      browser.process()?.kill('SIGKILL');
    } catch {
      /* already gone */
    }
    await new Promise((r) => setTimeout(r, 250));
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Run `fn` with a freshly launched Chromium and clean up everything it wrote to the temp folder
 * afterwards, whether `fn` succeeds, throws, or the browser has to be killed.
 * @template T
 * @param {(browser: import('puppeteer-core').Browser) => Promise<T>} fn
 * @returns {Promise<T>}
 */
export async function withBrowser(fn) {
  installExitHook();
  void sweepOrphans().catch(() => {});

  const profileDir = await mkdtemp(path.join(os.tmpdir(), PROFILE_PREFIX));
  state.live.add(profileDir);

  let browser;
  let socketDir = null;
  try {
    browser = await launchBrowser({ userDataDir: profileDir });
    socketDir = await singletonSocketDir(profileDir);
    if (socketDir) {
      state.live.add(socketDir);
      const pid = browser.process()?.pid;
      await writeFile(path.join(socketDir, MARKER_FILE), JSON.stringify({ pid, profileDir })).catch(() => {});
    }
    return await fn(browser);
  } finally {
    if (browser) await closeBrowser(browser);
    await Promise.all([removeDir(profileDir), removeDir(socketDir)]);
    state.live.delete(profileDir);
    if (socketDir) state.live.delete(socketDir);
  }
}
