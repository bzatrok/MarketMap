'use client';

import { DAY_LABELS } from '@/lib/constants';

export default function MarketCard({ market, onClick }) {
  return (
    <button
      onClick={() => onClick?.(market)}
      className="w-full text-left p-3 border border-gray-200 rounded-lg hover:border-primary hover:shadow-sm transition-all bg-white"
    >
      <h3 className="font-medium text-sm text-gray-900 truncate">{market.name}</h3>
      <div className="mt-1 space-y-0.5">
        {market.schedule.map((slot) => (
          <div key={slot.day} className="text-xs text-gray-500">
            {DAY_LABELS[slot.day] || slot.day} · {slot.timeStart}–{slot.timeEnd}
          </div>
        ))}
      </div>
      <div className="text-xs text-gray-400 mt-1">{market.province}</div>
    </button>
  );
}
