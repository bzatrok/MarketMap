import { DAY_LABELS } from '@/lib/constants';

export default function MarketDetail({ market }) {
  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">{market.name}</h1>
      <p className="text-gray-500 mb-6">{market.province}, {market.country}</p>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Schedule</div>
          {market.schedule.map((slot) => (
            <div key={slot.day} className="text-sm text-gray-600">
              <span className="font-medium">{DAY_LABELS[slot.day] || slot.day}</span> · {slot.timeStart}–{slot.timeEnd}
            </div>
          ))}
          {market.seasonNote && (
            <div className="text-xs text-gray-400 mt-1">{market.seasonNote}</div>
          )}
        </div>
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Type</div>
          <div className="font-medium">{market.type}</div>
        </div>
      </div>

      {market.location && (
        <div className="mb-4">
          <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Location</div>
          <div className="text-sm">{market.location}, {market.cityTown}</div>
        </div>
      )}

      <div className="flex gap-3 text-sm">
        {market.url && (
          <a
            href={market.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            Website
          </a>
        )}
        {market.sourceUrl && (
          <a
            href={market.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            Source
          </a>
        )}
        {market.municipalityUrl && (
          <a
            href={market.municipalityUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            Municipality
          </a>
        )}
      </div>

      {market.lastVerified && (
        <div className="mt-6 text-xs text-gray-400">
          Last verified: {market.lastVerified}
        </div>
      )}
    </div>
  );
}
