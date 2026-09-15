import { Geist, Geist_Mono } from 'next/font/google';
import { SITE_URL } from '@/lib/site';
import './globals.css';

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] });
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] });
const TITLE = 'Markdown Studio — Markdown to PDF with live preview';
const DESCRIPTION =
  'Write Markdown and export beautiful PDFs. Live preview, professional themes, custom fonts, logo and branding, running headers and footers, cover pages, table of contents, diagrams and syntax highlighting. Free, no sign-up.';

const SHARE_IMAGE = {
  url: '/og.png',
  width: 1200,
  height: 630,
  alt: 'Markdown Studio — Markdown to PDF with live preview',
  type: 'image/png',
};

export const metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: TITLE, template: '%s · Markdown Studio' },
  description: DESCRIPTION,
  keywords: ['markdown to pdf', 'markdown editor', 'md to pdf', 'pdf generator', 'markdown converter', 'github flavored markdown', 'document export'],
  applicationName: 'Markdown Studio',
  authors: [{ name: 'Markdown Studio', url: SITE_URL }],
  creator: 'Markdown Studio',
  publisher: 'Markdown Studio',
  category: 'productivity',
  alternates: { canonical: '/' },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: SITE_URL,
    siteName: 'Markdown Studio',
    locale: 'en_US',
    type: 'website',
    images: [SHARE_IMAGE],
  },
  twitter: {
    card: 'summary_large_image',
    title: TITLE,
    description: DESCRIPTION,
    images: [SHARE_IMAGE],
  },
  icons: {
    icon: [
      { url: '/icon.svg', type: 'image/svg+xml' },
      { url: '/favicon.ico', sizes: '32x32' },
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicon-192x192.png', sizes: '192x192', type: 'image/png' },
      { url: '/favicon-512x512.png', sizes: '512x512', type: 'image/png' },
    ],
    shortcut: '/favicon.ico',
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
    other: [{ rel: 'mask-icon', url: '/safari-pinned-tab.svg', color: '#2553eb' }],
  },
  manifest: '/manifest.json',
  appleWebApp: { capable: true, title: 'Markdown Studio', statusBarStyle: 'default' },
  formatDetection: { telephone: false, email: false, address: false },
  other: { 'msapplication-TileColor': '#2553eb' },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1 } },
};

export const viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0b0f17' },
  ],
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Apply the persisted UI theme before paint to avoid a flash. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var u=JSON.parse(localStorage.getItem('md2pdf:ui:v2')||'{}');if(u.dark)document.documentElement.classList.add('dark')}catch(e){}`,
          }}
        />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>{children}</body>
    </html>
  );
}
