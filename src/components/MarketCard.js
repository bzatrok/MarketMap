'use client';

import { DAY_LABELS } from '@/lib/constants';

export default function MarketCard({ market, onClick }) {
  const dayLabel = market.schedule.days.map((d) => DAY_LABELS[d] || d).join(', ');

  return (
    <button
      onClick={() => onClick?.(market)}
      className="w-full text-left p-3 border border-gray-200 rounded-lg hover:border-primary hover:shadow-sm transition-all bg-white"
    >
      <h3 className="font-medium text-sm text-gray-900 truncate">{market.name}</h3>
      <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
        <span>{dayLabel}</span>
        <span>·</span>
        <span>{market.schedule.timeStart}–{market.schedule.timeEnd}</span>
      </div>
      <div className="text-xs text-gray-400 mt-1">{market.province}</div>
    </button>
  );
}
