/** @type {import('next').NextConfig} */
const nextConfig = {
  // Keep the headless-browser packages out of the server bundle so their native/binary bits resolve at runtime.
  serverExternalPackages: ['puppeteer-core', '@sparticuz/chromium-min'],
};

export default nextConfig;
