import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getMarketsByProvince, getProvinces, slugifyProvince } from '@/lib/markets';
import { DAY_LABELS_NL, formatTypeNL } from '@/lib/i18n';

export async function generateStaticParams() {
  const provinces = getProvinces();
  return provinces.map((p) => ({ slug: slugifyProvince(p) }));
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const provinces = getProvinces();
  const province = provinces.find((p) => slugifyProvince(p) === slug);
  if (!province) return {};

  const markets = getMarketsByProvince(slug);
  const title = `Weekmarkten in ${province} — ${markets.length} markten | Weekmarkten Nederland`;
  const description = `Overzicht van alle ${markets.length} weekmarkten in ${province}. Vind openingstijden, locaties en meer informatie over markten in jouw provincie.`;
  const url = `https://marketmap.amberglass.nl/provinces/${slug}`;

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title: `Weekmarkten in ${province}`,
      description,
      url,
      siteName: 'Weekmarkten Nederland',
      locale: 'nl_NL',
      type: 'website',
    },
  };
}

export default async function ProvincePage({ params }) {
  const { slug } = await params;
  const provinces = getProvinces();
  const province = provinces.find((p) => slugifyProvince(p) === slug);
  if (!province) notFound();

  const markets = getMarketsByProvince(slug);

  // Group by day
  const byDay = {};
  for (const m of markets) {
    for (const s of m.schedule) {
      if (!byDay[s.day]) byDay[s.day] = [];
      byDay[s.day].push({ market: m, slot: s });
    }
  }

  const dayOrder = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 overflow-y-auto h-full">
      <nav className="text-sm text-gray-500 mb-4">
        <Link href="/" className="hover:text-blue-600">Home</Link>
        {' / '}
        <Link href="/markets" className="hover:text-blue-600">Markten</Link>
        {' / '}
        <span className="text-gray-900">{province}</span>
      </nav>

      <h1 className="text-2xl font-bold mb-2">Weekmarkten in {province}</h1>
      <p className="text-sm text-gray-500 mb-6">
        {markets.length} markten gevonden in {province}
      </p>

      {dayOrder.map((day) => {
        const entries = byDay[day];
        if (!entries || entries.length === 0) return null;

        const sorted = entries.sort((a, b) =>
          a.market.cityTown.localeCompare(b.market.cityTown)
        );

        return (
          <section key={day} className="mb-6">
            <h2 className="text-lg font-semibold mb-3">
              {DAY_LABELS_NL[day]}
              <span className="text-sm font-normal text-gray-400 ml-2">
                {entries.length} markten
              </span>
            </h2>
            <div className="space-y-2">
              {sorted.map(({ market, slot }) => (
                <Link
                  key={`${market.id}-${slot.day}`}
                  href={`/markets/${market.id}`}
                  className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:border-blue-400 hover:shadow-sm transition-all bg-white"
                >
                  <div>
                    <h3 className="font-medium text-sm text-gray-900">{market.name}</h3>
                    <div className="text-xs text-gray-500">{formatTypeNL(market.type)}</div>
                  </div>
                  <div className="text-sm text-gray-600 whitespace-nowrap ml-4">
                    {slot.timeStart}–{slot.timeEnd}
                  </div>
                </Link>
              ))}
            </div>
          </section>
        );
      })}

      <div className="mt-8 p-4 bg-blue-50 rounded-lg">
        <p className="text-sm text-blue-800">
          Bekijk alle markten op de{' '}
          <Link href="/" className="font-medium underline">interactieve kaart</Link>.
        </p>
      </div>
    </div>
  );
}
