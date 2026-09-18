/** @type {import('next').NextConfig} */
const nextConfig = {
  // Keep the headless-browser packages out of the server bundle so their native/binary bits resolve at runtime.
  serverExternalPackages: ['puppeteer-core', '@sparticuz/chromium'],
  outputFileTracingIncludes: {
    '/api/convert': ['./node_modules/@sparticuz/chromium/**/*'],
    '/api/mcp': ['./node_modules/@sparticuz/chromium/**/*'],
    '/api/scrape': ['./node_modules/@sparticuz/chromium/**/*'],
    '/api/scrapehtml': ['./node_modules/@sparticuz/chromium/**/*'],
  },
};

export default nextConfig;
