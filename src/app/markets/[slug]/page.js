import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getMarkets, getMarketBySlug, slugifyProvince } from '@/lib/markets';
import { DAY_LABELS_NL, formatTypeNL, formatScheduleNL } from '@/lib/i18n';

export async function generateStaticParams() {
  const { markets } = getMarkets();
  return markets.map((m) => ({ slug: m.id }));
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const market = getMarketBySlug(slug);
  if (!market) return {};

  const scheduleText = formatScheduleNL(market.schedule);
  const typeLabel = formatTypeNL(market.type);
  const title = `${market.name} — ${typeLabel} | Weekmarkten Nederland`;
  const description = `${typeLabel} in ${market.cityTown}, ${market.province}. ${scheduleText}. Vind openingstijden, locatie en meer informatie.`;
  const url = `https://marketmap.amberglass.nl/markets/${market.id}`;

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      siteName: 'Weekmarkten Nederland',
      locale: 'nl_NL',
      type: 'website',
    },
    twitter: {
      card: 'summary',
      title,
      description,
    },
  };
}

function buildJsonLd(market) {
  const typeLabel = formatTypeNL(market.type);
  const scheduleText = formatScheduleNL(market.schedule);

  return {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: `${typeLabel} ${market.cityTown}`,
    description: `${typeLabel} op ${market.location} in ${market.cityTown}, ${market.province}. ${scheduleText}.`,
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    eventStatus: 'https://schema.org/EventScheduled',
    location: {
      '@type': 'Place',
      name: `${market.location}, ${market.cityTown}`,
      address: {
        '@type': 'PostalAddress',
        addressLocality: market.cityTown,
        addressRegion: market.province,
        addressCountry: 'NL',
      },
      ...(market._geo && {
        geo: {
          '@type': 'GeoCoordinates',
          latitude: market._geo.lat,
          longitude: market._geo.lng,
        },
      }),
    },
    organizer: {
      '@type': 'Organization',
      name: `Gemeente ${market.cityTown}`,
      ...(market.municipalityUrl && { url: market.municipalityUrl }),
    },
    ...(market.url && { url: market.url }),
  };
}

export default async function MarketDetailPage({ params }) {
  const { slug } = await params;
  const market = getMarketBySlug(slug);
  if (!market) notFound();

  const typeLabel = formatTypeNL(market.type);
  const jsonLd = buildJsonLd(market);
  const navUrl = market._geo
    ? `https://www.google.com/maps/dir/?api=1&destination=${market._geo.lat},${market._geo.lng}`
    : null;

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 overflow-y-auto h-full">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <nav className="text-sm text-gray-500 mb-4">
        <Link href="/" className="hover:text-blue-600">Home</Link>
        {' / '}
        <Link href={`/provinces/${slugifyProvince(market.province)}`} className="hover:text-blue-600">
          {market.province}
        </Link>
        {' / '}
        <span className="text-gray-900">{market.cityTown}</span>
      </nav>

      <h1 className="text-2xl font-bold text-gray-900 mb-1">{market.name}</h1>
      <p className="text-gray-500 mb-6">{typeLabel} — {market.province}</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="text-xs text-gray-500 uppercase tracking-wide mb-2">Openingstijden</div>
          {market.schedule.map((slot) => (
            <div key={slot.day} className="text-sm text-gray-700">
              <span className="font-medium">{DAY_LABELS_NL[slot.day]}</span>{' '}
              {slot.timeStart}–{slot.timeEnd}
            </div>
          ))}
          {market.seasonNote && (
            <div className="text-xs text-amber-600 mt-2">{market.seasonNote}</div>
          )}
        </div>

        <div className="bg-gray-50 rounded-lg p-4">
          <div className="text-xs text-gray-500 uppercase tracking-wide mb-2">Locatie</div>
          <div className="text-sm text-gray-700 font-medium">{market.location}</div>
          <div className="text-sm text-gray-500">{market.cityTown}, {market.province}</div>
          {navUrl && (
            <a
              href={navUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block mt-2 text-sm text-blue-600 hover:underline"
            >
              Route plannen →
            </a>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-3 text-sm mb-6">
        {market.url && (
          <a href={market.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
            Website →
          </a>
        )}
        {market.sourceUrl && (
          <a href={market.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
            Bron →
          </a>
        )}
        {market.municipalityUrl && (
          <a href={market.municipalityUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
            Gemeente →
          </a>
        )}
      </div>

      {market.lastVerified && (
        <div className="text-xs text-gray-400">
          Laatst gecontroleerd: {market.lastVerified}
        </div>
      )}
    </div>
  );
}
