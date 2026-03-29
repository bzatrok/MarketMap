import './globals.css';
import Script from 'next/script';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

export const metadata = {
  title: {
    default: 'Weekmarkten Nederland — Vind jouw weekmarkt',
    template: '%s | Weekmarkten Nederland',
  },
  description:
    'Vind weekmarkten in heel Nederland. Zoek op dag, provincie of stad. Bekijk openingstijden, locaties en routebeschrijvingen.',
  metadataBase: new URL('https://marketmap.amberglass.nl'),
  alternates: { canonical: '/' },
  openGraph: {
    title: 'Weekmarkten Nederland — Vind jouw weekmarkt',
    description:
      'Vind weekmarkten in heel Nederland. Zoek op dag, provincie of stad. Bekijk openingstijden, locaties en routebeschrijvingen.',
    url: 'https://marketmap.amberglass.nl',
    siteName: 'Weekmarkten Nederland',
    locale: 'nl_NL',
    type: 'website',
  },
  twitter: {
    card: 'summary',
    title: 'Weekmarkten Nederland',
    description: 'Vind weekmarkten in heel Nederland. Zoek op dag, provincie of stad.',
  },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }) {
  return (
    <html lang="nl">
      <body className="flex flex-col h-dvh">
        <Header />
        <main className="flex-1 relative overflow-hidden">{children}</main>
        <Footer />
        <Script
          src="https://scripts.simpleanalyticscdn.com/latest.js"
          data-collect-dnt="true"
          strategy="afterInteractive"
        />
        <noscript>
          <img
            src="https://queue.simpleanalyticscdn.com/noscript.gif?collect-dnt=true"
            alt=""
            referrerPolicy="no-referrer-when-downgrade"
          />
        </noscript>
      </body>
    </html>
  );
}
