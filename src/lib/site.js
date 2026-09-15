/** Canonical public origin. Overridable via NEXT_PUBLIC_SITE_URL. */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://md.dima.ua').replace(/\/$/, '');
