import { notFound } from 'next/navigation';
import client from '@/lib/meilisearch';
import MarketDetail from '@/components/MarketDetail';

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const index = client.index('markets');

  try {
    const market = await index.getDocument(slug);
    return {
      title: `${market.name} - Market Map`,
      description: `${market.name} in ${market.province}. ${market.schedule.days.join(', ')} ${market.schedule.timeStart}–${market.schedule.timeEnd}.`,
    };
  } catch {
    return { title: 'Market not found - Market Map' };
  }
}

export default async function MarketPage({ params }) {
  const { slug } = await params;
  const index = client.index('markets');

  let market;
  try {
    market = await index.getDocument(slug);
  } catch {
    notFound();
  }

  return (
    <div className="px-4 py-8">
      <MarketDetail market={market} />
    </div>
  );
}
