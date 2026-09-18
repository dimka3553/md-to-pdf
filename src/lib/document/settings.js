/**
 * Document design settings shared by the editor (live preview) and the
 * PDF export API. Everything here is plain JSON so it can be persisted in
 * localStorage and sent over the wire unchanged.
 */

export const THEMES = {
  clean: {
    name: 'Clean',
    description: 'Neutral, modern, blue accent',
    background: '#FFFFFF',
    text: '#1F2937',
    heading: '#111827',
    muted: '#6B7280',
    accent: '#2563EB',
    link: '#2563EB',
    border: '#E5E7EB',
    codeBackground: '#F8FAFC',
    codeText: '#1E293B',
    tableHeader: '#F3F4F6',
    tableStripe: '#F9FAFB',
    quoteBackground: '#F8FAFC',
    dark: false,
    defaultFont: 'inter',
    defaultHeadingFont: 'same',
  },
  corporate: {
    name: 'Corporate',
    description: 'Navy headings, formal spacing',
    background: '#FFFFFF',
    text: '#1E293B',
    heading: '#0B2A5B',
    muted: '#64748B',
    accent: '#0F4C81',
    link: '#0F4C81',
    border: '#D9E2EC',
    codeBackground: '#F0F4F8',
    codeText: '#102A43',
    tableHeader: '#0B2A5B',
    tableHeaderText: '#FFFFFF',
    tableStripe: '#F0F4F8',
    quoteBackground: '#F0F4F8',
    dark: false,
    defaultFont: 'ibm-plex-sans',
    defaultHeadingFont: 'same',
  },
  editorial: {
    name: 'Editorial',
    description: 'Serif body, warm paper tone',
    background: '#FFFDF8',
    text: '#292524',
    heading: '#1C1917',
    muted: '#78716C',
    accent: '#B45309',
    link: '#9A3412',
    border: '#E7E5E4',
    codeBackground: '#F5F5F4',
    codeText: '#292524',
    tableHeader: '#F5F5F4',
    tableStripe: '#FAFAF9',
    quoteBackground: '#FAF5EE',
    dark: false,
    defaultFont: 'source-serif',
    defaultHeadingFont: 'playfair',
  },
  forest: {
    name: 'Forest',
    description: 'Calm greens, soft contrast',
    background: '#F8FAF8',
    text: '#1F2A22',
    heading: '#14532D',
    muted: '#5B6B60',
    accent: '#16A34A',
    link: '#15803D',
    border: '#DDE6DF',
    codeBackground: '#EEF4EF',
    codeText: '#1F2A22',
    tableHeader: '#E3EEE5',
    tableStripe: '#F1F6F2',
    quoteBackground: '#EEF4EF',
    dark: false,
    defaultFont: 'lora',
    defaultHeadingFont: 'same',
  },
  mono: {
    name: 'Mono',
    description: 'Black on white, no color',
    background: '#FFFFFF',
    text: '#111111',
    heading: '#000000',
    muted: '#555555',
    accent: '#111111',
    link: '#111111',
    border: '#111111',
    codeBackground: '#F4F4F4',
    codeText: '#111111',
    tableHeader: '#111111',
    tableHeaderText: '#FFFFFF',
    tableStripe: '#FAFAFA',
    quoteBackground: '#F4F4F4',
    dark: false,
    defaultFont: 'space-grotesk',
    defaultHeadingFont: 'same',
  },
  midnight: {
    name: 'Midnight',
    description: 'Dark slate, light text',
    background: '#0F172A',
    text: '#E2E8F0',
    heading: '#F8FAFC',
    muted: '#94A3B8',
    accent: '#60A5FA',
    link: '#93C5FD',
    border: '#334155',
    codeBackground: '#1E293B',
    codeText: '#E2E8F0',
    tableHeader: '#1E293B',
    tableStripe: '#152036',
    quoteBackground: '#1E293B',
    dark: true,
    defaultFont: 'inter',
    defaultHeadingFont: 'same',
  },
};

export const FONTS = {
  inter: { name: 'Inter', family: "'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif", google: 'Inter:wght@400;500;600;700', kind: 'sans' },
  'ibm-plex-sans': { name: 'IBM Plex Sans', family: "'IBM Plex Sans', system-ui, sans-serif", google: 'IBM+Plex+Sans:wght@400;500;600;700', kind: 'sans' },
  roboto: { name: 'Roboto', family: "'Roboto', system-ui, sans-serif", google: 'Roboto:wght@400;500;700', kind: 'sans' },
  'space-grotesk': { name: 'Space Grotesk', family: "'Space Grotesk', system-ui, sans-serif", google: 'Space+Grotesk:wght@400;500;600;700', kind: 'sans' },
  'source-serif': { name: 'Source Serif 4', family: "'Source Serif 4', Georgia, 'Times New Roman', serif", google: 'Source+Serif+4:wght@400;600;700', kind: 'serif' },
  lora: { name: 'Lora', family: "'Lora', Georgia, serif", google: 'Lora:wght@400;600;700', kind: 'serif' },
  merriweather: { name: 'Merriweather', family: "'Merriweather', Georgia, serif", google: 'Merriweather:wght@400;700', kind: 'serif' },
  playfair: { name: 'Playfair Display', family: "'Playfair Display', Georgia, serif", google: 'Playfair+Display:wght@500;600;700', kind: 'serif' },
};

export const CODE_FONT = {
  family: "'JetBrains Mono', 'SF Mono', Menlo, Consolas, monospace",
  google: 'JetBrains+Mono:wght@400;500',
};

export const FONT_SIZES = {
  sm: { name: 'Compact', body: 9.5, label: '9.5pt' },
  md: { name: 'Comfortable', body: 10.5, label: '10.5pt' },
  lg: { name: 'Large', body: 12, label: '12pt' },
};

// Sizes in CSS pixels at 96 DPI, used for the preview sheet and header/footer layout.
export const PAPER_SIZES = {
  A4: { name: 'A4', width: 794, height: 1123, puppeteer: 'A4' },
  Letter: { name: 'US Letter', width: 816, height: 1056, puppeteer: 'Letter' },
  Legal: { name: 'US Legal', width: 816, height: 1344, puppeteer: 'Legal' },
};

export const MARGINS = {
  narrow: { name: 'Narrow', x: 40, y: 44 },
  normal: { name: 'Normal', x: 64, y: 64 },
  wide: { name: 'Wide', x: 96, y: 80 },
};

export const BACKGROUNDS = {
  none: { name: 'None' },
  soft: { name: 'Soft tint' },
  gradient: { name: 'Gradient' },
  dots: { name: 'Dots' },
  grid: { name: 'Grid' },
  lines: { name: 'Ruled lines' },
};

export const LOGO_POSITIONS = {
  'title-right': { name: 'Beside title' },
  'title-above': { name: 'Above title' },
  'page-header': { name: 'Every page header' },
  watermark: { name: 'Watermark' },
};

export const LOGO_SIZES = {
  sm: { name: 'Small', px: 32 },
  md: { name: 'Medium', px: 48 },
  lg: { name: 'Large', px: 72 },
};

export const PAGE_BREAK_MODES = {
  auto: { name: 'Automatic' },
  h1: { name: 'Before each H1' },
  h2: { name: 'Before each H1 & H2' },
};

export const DEFAULT_SETTINGS = {
  theme: 'clean',
  font: 'inherit', // 'inherit' = theme default
  headingFont: 'inherit',
  fontSize: 'md',
  accentColor: '', // '' = theme default
  paperSize: 'A4',
  orientation: 'portrait',
  margins: 'normal',
  background: 'none',
  pageBreaks: 'auto',
  toc: false,
  headingNumbers: false,
  justify: false,
  logo: null, // { dataUrl, name, position, size, aspect } — title / cover / watermark
  header: { text: '', showDate: false, logo: null }, // logo is independent of logo.position
  footer: { text: '', pageNumbers: true, pageNumberStyle: 'n-of-total' },
  cover: { enabled: false, title: '', subtitle: '', author: '', date: '', showLogo: true },
};

const pick = (value, allowed, fallback) => (value && allowed[value] ? value : fallback);

function normalizeImage(raw, fallbackName = 'logo') {
  if (!raw || typeof raw !== 'object' || typeof raw.dataUrl !== 'string' || !raw.dataUrl.startsWith('data:image/')) return null;
  return {
    dataUrl: raw.dataUrl,
    name: typeof raw.name === 'string' ? raw.name.slice(0, 200) : fallbackName,
    aspect: Number.isFinite(raw.aspect) && raw.aspect > 0 ? Math.min(20, Math.max(0.1, raw.aspect)) : 1,
  };
}

/** Normalise arbitrary input (localStorage, API body) into a safe settings object. */
export function normalizeSettings(input) {
  const s = input && typeof input === 'object' ? input : {};
  const d = DEFAULT_SETTINGS;

  const image = normalizeImage(s.logo);
  const logo = image
    ? {
        ...image,
        position: pick(s.logo.position, LOGO_POSITIONS, 'title-right'),
        size: pick(s.logo.size, LOGO_SIZES, 'md'),
      }
    : null;

  const accent = typeof s.accentColor === 'string' && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(s.accentColor) ? s.accentColor : '';

  return {
    theme: pick(s.theme, THEMES, d.theme),
    font: s.font === 'inherit' || !s.font ? 'inherit' : pick(s.font, FONTS, 'inherit'),
    headingFont: s.headingFont === 'inherit' || !s.headingFont ? 'inherit' : s.headingFont === 'same' ? 'same' : pick(s.headingFont, FONTS, 'inherit'),
    fontSize: pick(s.fontSize, FONT_SIZES, d.fontSize),
    accentColor: accent,
    paperSize: pick(s.paperSize, PAPER_SIZES, d.paperSize),
    orientation: s.orientation === 'landscape' ? 'landscape' : 'portrait',
    margins: pick(s.margins, MARGINS, d.margins),
    background: pick(s.background, BACKGROUNDS, d.background),
    pageBreaks: pick(s.pageBreaks, PAGE_BREAK_MODES, d.pageBreaks),
    toc: !!s.toc,
    headingNumbers: !!s.headingNumbers,
    justify: !!s.justify,
    logo,
    header: {
      text: str(s.header?.text, 200),
      showDate: !!s.header?.showDate,
      logo: normalizeImage(s.header?.logo, 'header-logo'),
    },
    footer: {
      text: str(s.footer?.text, 200),
      pageNumbers: s.footer?.pageNumbers !== false,
      pageNumberStyle: s.footer?.pageNumberStyle === 'n' ? 'n' : 'n-of-total',
    },
    cover: {
      enabled: !!s.cover?.enabled,
      title: str(s.cover?.title, 300),
      subtitle: str(s.cover?.subtitle, 500),
      author: str(s.cover?.author, 200),
      date: str(s.cover?.date, 100),
      showLogo: s.cover?.showLogo !== false,
    },
  };
}

/**
 * Deep-merge a settings patch over a previously stored (or empty) object, then
 * normalise. `null` on `logo` / `header.logo` clears that image; omitted keys keep the base.
 */
export function mergeSettings(base, patch) {
  const current = base && typeof base === 'object' ? base : {};
  if (!patch || typeof patch !== 'object') return normalizeSettings(current);

  const logo = patch.logo === null
    ? null
    : patch.logo && typeof patch.logo === 'object'
      ? { ...(current.logo || {}), ...patch.logo }
      : current.logo;

  let header = current.header;
  if (patch.header && typeof patch.header === 'object') {
    header = { ...(current.header || {}), ...patch.header };
    if (patch.header.logo === null) header.logo = null;
    else if (patch.header.logo && typeof patch.header.logo === 'object') {
      header.logo = { ...(current.header?.logo || {}), ...patch.header.logo };
    }
  }

  return normalizeSettings({
    ...current,
    ...patch,
    logo,
    header,
    footer: patch.footer && typeof patch.footer === 'object' ? { ...(current.footer || {}), ...patch.footer } : current.footer,
    cover: patch.cover && typeof patch.cover === 'object' ? { ...(current.cover || {}), ...patch.cover } : current.cover,
  });
}

/** Running-header logo: dedicated header.logo, or the legacy logo.position="page-header". */
export function headerLogoOf(settings) {
  if (settings?.header?.logo) return settings.header.logo;
  if (settings?.logo?.position === 'page-header') return settings.logo;
  return null;
}

function str(v, max) {
  return typeof v === 'string' ? v.slice(0, max) : '';
}

/** Resolve the concrete theme/fonts for a normalised settings object. */
export function resolveDesign(settings) {
  const theme = THEMES[settings.theme];
  const fontKey = settings.font === 'inherit' ? theme.defaultFont : settings.font;
  const headingKeyRaw = settings.headingFont === 'inherit' ? theme.defaultHeadingFont : settings.headingFont;
  const headingKey = headingKeyRaw === 'same' ? fontKey : headingKeyRaw;
  const accent = settings.accentColor || theme.accent;

  const paper = PAPER_SIZES[settings.paperSize];
  const landscape = settings.orientation === 'landscape';
  const pageWidth = landscape ? paper.height : paper.width;
  const pageHeight = landscape ? paper.width : paper.height;

  return {
    theme: { ...theme, accent, link: settings.accentColor ? accent : theme.link },
    font: FONTS[fontKey],
    headingFont: FONTS[headingKey],
    fontSize: FONT_SIZES[settings.fontSize],
    margins: MARGINS[settings.margins],
    pageWidth,
    pageHeight,
    hasRunningHeader: !!(settings.header.text.trim() || settings.header.showDate || headerLogoOf(settings)),
    hasRunningFooter: !!(settings.footer.text || settings.footer.pageNumbers),
  };
}
