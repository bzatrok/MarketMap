export default function robots() {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/admin/', '/login'],
      },
    ],
    sitemap: 'https://marketmap.amberglass.nl/sitemap.xml',
  };
}
