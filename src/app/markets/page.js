import Link from 'next/link';
import client from '@/lib/meilisearch';
import { DAY_LABELS } from '@/lib/constants';

export const metadata = {
  title: 'All Markets - Market Map',
  description: 'Browse weekly markets across the Netherlands by region.',
};

export default async function MarketsPage({ searchParams }) {
  const params = await searchParams;
  const province = params?.province || '';

  const index = client.index('markets');
  const filter = province ? [`province = "${province}"`] : [];
  const results = await index.search('', { filter, limit: 500, sort: ['name:asc'] });

  // Group unique provinces from results
  const provinces = [...new Set(results.hits.map((m) => m.province))].sort();

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-4">
        {province ? `Markets in ${province}` : 'All Markets'}
      </h1>

      {!province && (
        <div className="flex flex-wrap gap-2 mb-6">
          {provinces.map((p) => (
            <Link
              key={p}
              href={`/markets?province=${encodeURIComponent(p)}`}
              className="px-3 py-1 bg-gray-100 text-sm rounded-full hover:bg-primary hover:text-white transition-colors"
            >
              {p}
            </Link>
          ))}
        </div>
      )}

      {province && (
        <Link href="/markets" className="text-primary text-sm hover:underline mb-4 inline-block">
          View all provinces
        </Link>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {results.hits.map((market) => {
          const dayLabel = market.schedule.days.map((d) => DAY_LABELS[d] || d).join(', ');
          return (
            <Link
              key={market.id}
              href={`/markets/${market.id}`}
              className="block p-4 border border-gray-200 rounded-lg hover:border-primary hover:shadow-sm transition-all"
            >
              <h2 className="font-medium text-gray-900">{market.name}</h2>
              <div className="text-sm text-gray-500 mt-1">
                {dayLabel} · {market.schedule.timeStart}–{market.schedule.timeEnd}
              </div>
              <div className="text-xs text-gray-400 mt-1">{market.province}</div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
