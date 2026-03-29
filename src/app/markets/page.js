import Link from 'next/link';
import { getMarkets, slugifyProvince } from '@/lib/markets';
import { DAY_LABELS_NL, formatTypeNL } from '@/lib/i18n';

export const metadata = {
  title: 'Alle Weekmarkten in Nederland — Overzicht | Weekmarkten Nederland',
  description:
    'Compleet overzicht van alle weekmarkten in Nederland. Zoek op stad, provincie of dag. Vind openingstijden en locaties.',
  alternates: { canonical: 'https://marketmap.amberglass.nl/markets' },
  openGraph: {
    title: 'Alle Weekmarkten in Nederland',
    description: 'Compleet overzicht van alle weekmarkten in Nederland. Zoek op stad, provincie of dag.',
    url: 'https://marketmap.amberglass.nl/markets',
    siteName: 'Weekmarkten Nederland',
    locale: 'nl_NL',
    type: 'website',
  },
};

export default function MarketsListPage() {
  const { markets } = getMarkets();

  // Group by province
  const byProvince = {};
  for (const m of markets) {
    if (!byProvince[m.province]) byProvince[m.province] = [];
    byProvince[m.province].push(m);
  }
  const provinces = Object.keys(byProvince).sort();

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 overflow-y-auto h-full">
      <h1 className="text-2xl font-bold mb-2">Alle weekmarkten in Nederland</h1>
      <p className="text-sm text-gray-500 mb-6">
        {markets.length} markten in {provinces.length} provincies
      </p>

      {provinces.map((province) => {
        const provinceMarkets = byProvince[province].sort((a, b) =>
          a.cityTown.localeCompare(b.cityTown)
        );

        return (
          <section key={province} className="mb-8">
            <h2 className="text-lg font-semibold mb-3">
              <Link
                href={`/provinces/${slugifyProvince(province)}`}
                className="hover:text-blue-600"
              >
                {province}
              </Link>
              <span className="text-sm font-normal text-gray-400 ml-2">
                {provinceMarkets.length} markten
              </span>
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {provinceMarkets.map((m) => (
                <Link
                  key={m.id}
                  href={`/markets/${m.id}`}
                  className="block p-3 border border-gray-200 rounded-lg hover:border-blue-400 hover:shadow-sm transition-all bg-white"
                >
                  <h3 className="font-medium text-sm text-gray-900 truncate">{m.name}</h3>
                  <div className="text-xs text-gray-500 mt-1">
                    {formatTypeNL(m.type)}
                  </div>
                  <div className="text-xs text-gray-400 mt-0.5">
                    {m.schedule
                      .map((s) => `${DAY_LABELS_NL[s.day]} ${s.timeStart}–${s.timeEnd}`)
                      .join(' · ')}
                  </div>
                </Link>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
