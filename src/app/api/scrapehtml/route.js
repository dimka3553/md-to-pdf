import { createScrapeHandler, OPTIONS } from '@/lib/scraper/handler.js';

export const runtime = 'nodejs';
export const maxDuration = 60;

export const GET = createScrapeHandler('html');
export { OPTIONS };
