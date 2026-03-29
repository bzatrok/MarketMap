import { getMarkets, getProvinces, slugifyProvince } from '@/lib/markets';

const BASE_URL = 'https://marketmap.amberglass.nl';

export default function sitemap() {
  const { markets } = getMarkets();
  const provinces = getProvinces();

  const staticPages = [
    { url: BASE_URL, lastModified: new Date(), changeFrequency: 'weekly', priority: 1.0 },
    { url: `${BASE_URL}/markets`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.9 },
    { url: `${BASE_URL}/sources`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.3 },
  ];

  const provincePages = provinces.map((p) => ({
    url: `${BASE_URL}/provinces/${slugifyProvince(p)}`,
    lastModified: new Date(),
    changeFrequency: 'weekly',
    priority: 0.8,
  }));

  const marketPages = markets.map((m) => ({
    url: `${BASE_URL}/markets/${m.id}`,
    lastModified: new Date(),
    changeFrequency: 'monthly',
    priority: 0.6,
  }));

  return [...staticPages, ...provincePages, ...marketPages];
}
