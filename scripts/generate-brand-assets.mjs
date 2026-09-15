/**
 * Rasterize the Markdown Studio mark into favicons, PWA icons, and the
 * Open Graph image used when the site is shared.
 */
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const publicDir = path.join(root, 'public');
const iconSvg = await readFile(path.join(publicDir, 'icon.svg'));

function pngToIco(png) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(1, 4);
  const entry = Buffer.alloc(16);
  entry[0] = 32;
  entry[1] = 32;
  entry.writeUInt16LE(1, 4);
  entry.writeUInt16LE(32, 6);
  entry.writeUInt32LE(png.length, 8);
  entry.writeUInt32LE(22, 12);
  return Buffer.concat([header, entry, png]);
}

async function raster(size, file) {
  const buf = await sharp(iconSvg, { density: 384 }).resize(size, size).png().toBuffer();
  await writeFile(path.join(publicDir, file), buf);
  return buf;
}

const ogSvg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="#0b0f17"/>
  <rect width="1200" height="630" fill="url(#g)"/>
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1200" y2="630">
      <stop offset="0" stop-color="#2553eb" stop-opacity="0.28"/>
      <stop offset="1" stop-color="#0b0f17" stop-opacity="0"/>
    </linearGradient>
  </defs>
  <g transform="translate(88 215)">
    <rect width="160" height="160" rx="36" fill="#2553eb"/>
    <g transform="translate(0 0) scale(5)">
      <path fill="#fff" d="M6.6 23.4V8.6h2.55l3.35 8.05 3.35-8.05H18.4v14.8h-2.45v-9.7l-2.7 6.45h-1.6l-2.7-6.45v9.7H6.6Z"/>
      <path fill="#fff" d="M21.15 9.4h2.45v7.55h2.05L22.38 22.6l-3.27-5.65h2.04V9.4Z"/>
    </g>
  </g>
  <text x="288" y="278" fill="#ffffff" font-family="ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" font-size="64" font-weight="700">Markdown Studio</text>
  <text x="288" y="338" fill="#c7d2fe" font-family="ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" font-size="30" font-weight="500">Markdown to PDF with live preview</text>
  <text x="288" y="400" fill="#94a3b8" font-family="ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" font-size="22">Themes, branding, diagrams — free, no sign-up</text>
  <text x="88" y="560" fill="#64748b" font-family="ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" font-size="20">md-to-pdf.vercel.app</text>
</svg>`);

await raster(16, 'favicon-16x16.png');
await raster(32, 'favicon-32x32.png');
const png32 = await raster(32, 'favicon-32x32.png');
await writeFile(path.join(publicDir, 'favicon.ico'), pngToIco(png32));
await raster(180, 'apple-touch-icon.png');
await raster(192, 'favicon-192x192.png');
await raster(512, 'favicon-512x512.png');
await raster(512, 'logo.png');
await sharp(ogSvg).png().toFile(path.join(publicDir, 'og.png'));

console.log('Wrote Markdown Studio icons and og.png');
