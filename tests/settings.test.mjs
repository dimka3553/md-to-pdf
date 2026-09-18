import assert from 'node:assert/strict';
import { test } from 'node:test';
import { headerLogoOf, mergeSettings, normalizeSettings, resolveDesign } from '../src/lib/document/settings.js';

const png = 'data:image/png;base64,AAA';
const svg = 'data:image/svg+xml;base64,BBB';

test('header.logo is independent of logo.position', () => {
  const settings = normalizeSettings({
    logo: { dataUrl: png, position: 'title-right', size: 'md', aspect: 2 },
    header: { text: 'Acme', logo: { dataUrl: svg, aspect: 3 } },
    cover: { enabled: true, showLogo: true },
  });
  assert.equal(settings.logo.position, 'title-right');
  assert.equal(settings.logo.dataUrl, png);
  assert.equal(settings.header.logo.dataUrl, svg);
  assert.equal(settings.header.logo.aspect, 3);
  assert.equal(headerLogoOf(settings).dataUrl, svg);
  assert.equal(resolveDesign(settings).hasRunningHeader, true);
});

test('logo.position page-header remains a legacy header-logo shortcut', () => {
  const settings = normalizeSettings({
    logo: { dataUrl: png, position: 'page-header', aspect: 2 },
  });
  assert.equal(settings.header.logo, null);
  assert.equal(headerLogoOf(settings).dataUrl, png);
  assert.equal(resolveDesign(settings).hasRunningHeader, true);
});

test('mergeSettings applies a patch over stored settings without dropping nested fields', () => {
  const base = normalizeSettings({
    theme: 'corporate',
    toc: true,
    header: { text: 'Acme', showDate: true },
    logo: { dataUrl: png, position: 'title-right' },
  });
  const merged = mergeSettings(base, { theme: 'midnight', header: { showDate: false } });
  assert.equal(merged.theme, 'midnight');
  assert.equal(merged.toc, true);
  assert.equal(merged.header.text, 'Acme');
  assert.equal(merged.header.showDate, false);
  assert.equal(merged.logo.position, 'title-right');
});

test('mergeSettings nulls clear logos', () => {
  const base = normalizeSettings({
    logo: { dataUrl: png, position: 'title-right' },
    header: { logo: { dataUrl: svg } },
  });
  const cleared = mergeSettings(base, { logo: null, header: { logo: null } });
  assert.equal(cleared.logo, null);
  assert.equal(cleared.header.logo, null);
  assert.equal(headerLogoOf(cleared), null);
});
