import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Script from 'next/script';
import { GA_MEASUREMENT_ID } from '@/lib/gtag';

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "Markdown to PDF Converter | Free Online MD to PDF Tool",
  description: "Convert Markdown to PDF online instantly. Free, fast, and easy-to-use Markdown to PDF converter with live preview. Supports GitHub Flavored Markdown, code highlighting, and custom themes.",
  keywords: "markdown to pdf, md to pdf converter, markdown converter, pdf generator, online markdown editor, github markdown, document converter",
  authors: [{ name: "MD to PDF Team" }],
  creator: "MD to PDF",
  publisher: "MD to PDF",
  formatDetection: {
    email: false,
    telephone: false,
  },
  metadataBase: new URL('https://md-to-pdf.vercel.app'),
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: 'Markdown to PDF Converter | Free Online MD to PDF Tool',
    description: 'Convert Markdown to PDF online instantly. Free, fast, and easy-to-use Markdown to PDF converter with live preview.',
    url: 'https://md-to-pdf.vercel.app',
    siteName: 'MD to PDF Converter',
    locale: 'en_US',
    type: 'website',
    images: [
      {
        url: '/logo.png',
        width: 800,
        height: 600,
        alt: 'MD to PDF Converter Logo',
      }
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Markdown to PDF Converter | Free Online MD to PDF Tool',
    description: 'Convert Markdown to PDF online instantly. Free, fast, and easy-to-use Markdown to PDF converter with live preview.',
    creator: '@mdtopdf',
    images: ['/logo.png'],
  },
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicon-192x192.png', sizes: '192x192', type: 'image/png' },
      { url: '/favicon-512x512.png', sizes: '512x512', type: 'image/png' }
    ],
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
    other: [
      {
        rel: 'mask-icon',
        url: '/safari-pinned-tab.svg',
        color: '#ff0000',
      }
    ]
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  verification: {
    google: 'your-google-verification-code',
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        {/* Google Analytics */}
        <Script
          strategy="afterInteractive"
          src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
        />
        <Script
          id="google-analytics"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', '${GA_MEASUREMENT_ID}', {
                page_path: window.location.pathname,
              });
            `,
          }}
        />
        {/* Standard favicon */}
        <link rel="icon" href="/favicon.ico" sizes="any" />
        {/* PNG favicons */}
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
        <link rel="icon" type="image/png" sizes="192x192" href="/favicon-192x192.png" />
        <link rel="icon" type="image/png" sizes="512x512" href="/favicon-512x512.png" />
        {/* Apple Touch Icon */}
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
        {/* Safari Pinned Tab */}
        <link rel="mask-icon" href="/safari-pinned-tab.svg" color="#ff0000" />
        {/* Web Manifest */}
        <link rel="manifest" href="/manifest.json" />
        {/* Microsoft Tile Color */}
        <meta name="msapplication-TileColor" content="#ff0000" />
        <meta name="theme-color" content="#ffffff" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
