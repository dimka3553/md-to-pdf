'use client';

/**
 * Read an image file into a data URL, downscaling raster images so embedded
 * documents (and localStorage) stay small. SVGs are kept verbatim.
 *
 * @param {File} file
 * @param {{ maxSize?: number, quality?: number }} opts
 * @returns {Promise<{ dataUrl: string, width: number, height: number, name: string }>}
 */
export async function fileToDataUrl(file, { maxSize = 1600, quality = 0.86 } = {}) {
  if (!file.type.startsWith('image/')) throw new Error('Not an image file.');
  const name = sanitizeAssetName(file.name);

  if (file.type === 'image/svg+xml' || file.type === 'image/gif') {
    const dataUrl = await readAsDataUrl(file);
    const dims = await measureDataUrl(dataUrl).catch(() => ({ width: 0, height: 0 }));
    return { dataUrl, ...dims, name };
  }

  const bitmap = await loadBitmap(file);
  const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close?.();

  const hasAlpha = file.type === 'image/png' || file.type === 'image/webp';
  const dataUrl = hasAlpha ? canvas.toDataURL('image/png') : canvas.toDataURL('image/jpeg', quality);
  return { dataUrl, width, height, name };
}

function readAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error || new Error('Could not read file'));
    reader.readAsDataURL(file);
  });
}

function measureDataUrl(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => reject(new Error('Could not decode image'));
    img.src = dataUrl;
  });
}

async function loadBitmap(file) {
  if ('createImageBitmap' in window) {
    try {
      return await createImageBitmap(file);
    } catch {
      /* fall back to <img> */
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    await new Promise((res, rej) => {
      img.onload = res;
      img.onerror = () => rej(new Error('Could not decode image'));
      img.src = url;
    });
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function sanitizeAssetName(name) {
  const cleaned = String(name || 'image')
    .replace(/[^\w.\-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '');
  return cleaned || 'image';
}

/** Ensure a unique asset key given existing keys ("logo.png" → "logo-2.png"). */
export function uniqueAssetName(name, existing) {
  if (!existing[name]) return name;
  const dot = name.lastIndexOf('.');
  const base = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot) : '';
  let i = 2;
  while (existing[`${base}-${i}${ext}`]) i++;
  return `${base}-${i}${ext}`;
}

export function approxBytes(dataUrl) {
  const comma = dataUrl.indexOf(',');
  return Math.round(((dataUrl.length - comma - 1) * 3) / 4);
}

export function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
