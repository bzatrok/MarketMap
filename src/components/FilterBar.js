'use client';

import { DAYS_OF_WEEK, DAY_LABELS, PROVINCES } from '@/lib/constants';

export default function FilterBar({ selectedDays, onDaysChange, selectedProvinces, onProvincesChange }) {
  function toggleDay(day) {
    if (selectedDays.includes(day)) {
      onDaysChange(selectedDays.filter((d) => d !== day));
    } else {
      onDaysChange([...selectedDays, day]);
    }
  }

  function toggleProvince(province) {
    if (selectedProvinces.includes(province)) {
      onProvincesChange(selectedProvinces.filter((p) => p !== province));
    } else {
      onProvincesChange([...selectedProvinces, province]);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2 block">
          Days
        </label>
        <div className="flex gap-1">
          {DAYS_OF_WEEK.map((day) => (
            <button
              key={day}
              onClick={() => toggleDay(day)}
              className={`px-2 py-1 text-xs rounded-md border transition-colors ${
                selectedDays.includes(day)
                  ? 'bg-blue-50 text-blue-700 border-blue-500'
                  : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'
              }`}
            >
              {DAY_LABELS[day]}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2 block">
          Provinces
        </label>
        <div className="flex flex-wrap gap-1">
          {PROVINCES.map((province) => (
            <button
              key={province}
              onClick={() => toggleProvince(province)}
              className={`px-2 py-1 text-xs rounded-md border transition-colors ${
                selectedProvinces.includes(province)
                  ? 'bg-blue-50 text-blue-700 border-blue-500'
                  : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'
              }`}
            >
              {province}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
