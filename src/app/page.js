import EditorApp from '@/components/editor/EditorApp';
import { SITE_URL } from '@/lib/site';

const structuredData = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'Markdown Studio — Markdown to PDF',
  url: SITE_URL,
  applicationCategory: 'WebApplication',
  operatingSystem: 'Any',
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
  image: `${SITE_URL}/og.png`,
  logo: `${SITE_URL}/logo.png`,
  description:
    'Free online Markdown editor and PDF converter with live preview, themes, custom fonts, logos, headers, footers, cover pages and table of contents.',
};

export default function Home() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
      <EditorApp />
    </>
  );
}
