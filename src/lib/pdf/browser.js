import puppeteerCore from 'puppeteer-core';

// Must match the @sparticuz/chromium-min major version in package.json.
const REMOTE_CHROMIUM_PACK = 'https://github.com/Sparticuz/chromium/releases/download/v133.0.0/chromium-v133.0.0-pack.tar';

const COMMON_ARGS = ['--no-sandbox', '--disable-setuid-sandbox', '--font-render-hinting=none', '--disable-dev-shm-usage'];

async function launchServerless() {
  const chromium = (await import('@sparticuz/chromium-min')).default;
  const executablePath = await chromium.executablePath(REMOTE_CHROMIUM_PACK);
  return puppeteerCore.launch({
    executablePath,
    args: [...chromium.args, ...COMMON_ARGS],
    headless: true,
    defaultViewport: { width: 1280, height: 1024 },
  });
}

/**
 * Launch Chromium. On Vercel (or when PUPPETEER_EXECUTABLE_PATH is unset and
 * no local Chrome is found) the serverless chromium pack is used; locally we
 * prefer an installed Chrome so `npm run dev` works with zero setup.
 */
export async function launchBrowser() {
  if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
    return launchServerless();
  }

  if (process.env.PUPPETEER_EXECUTABLE_PATH) {
    return puppeteerCore.launch({ executablePath: process.env.PUPPETEER_EXECUTABLE_PATH, args: COMMON_ARGS, headless: true });
  }

  for (const channel of ['chrome', 'chrome-canary', 'chrome-beta']) {
    try {
      return await puppeteerCore.launch({ channel, args: COMMON_ARGS, headless: true });
    } catch {
      /* try next */
    }
  }

  return launchServerless();
}
