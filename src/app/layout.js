import './globals.css';

export const metadata = {
  title: 'Market Map - Weekly Market Finder',
  description: 'Find weekly markets in the Netherlands and surrounding regions. Search by day, region, or name.',
  viewport: 'width=device-width, initial-scale=1',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
