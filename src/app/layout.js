import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

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
      { url: '/logo.png', sizes: '32x32', type: 'image/png' },
      { url: '/logo.png', sizes: '16x16', type: 'image/png' }
    ],
    apple: [
      { url: '/logo.png', sizes: '180x180', type: 'image/png' },
    ],
    other: [
      {
        rel: 'mask-icon',
        url: '/logo.png',
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
    google: 'your-google-verification-code', // You'll need to replace this with your actual verification code
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/logo.png" sizes="any" />
        <link rel="apple-touch-icon" href="/logo.png" />
        <link rel="manifest" href="/manifest.json" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
