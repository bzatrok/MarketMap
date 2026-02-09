import './globals.css';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

export const metadata = {
  title: 'Market Map - Weekly Market Finder',
  description: 'Find weekly markets in the Netherlands and surrounding regions. Search by day, region, or name.',
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="flex flex-col h-dvh">
        <Header />
        <main className="flex-1 relative overflow-hidden">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
