'use client';

import { useState, useEffect } from 'react';

export default function SearchInput({ value, onChange }) {
  const [local, setLocal] = useState(value || '');

  useEffect(() => {
    setLocal(value || '');
  }, [value]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (local !== value) onChange(local);
    }, 300);
    return () => clearTimeout(timer);
  }, [local, value, onChange]);

  return (
    <div className="relative w-full">
      <input
        type="text"
        placeholder="Search markets..."
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        className="w-full px-3 py-2 pr-8 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
      />
      {local && (
        <button
          onClick={() => setLocal('')}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-sm leading-none"
          aria-label="Clear search"
        >
          ✕
        </button>
      )}
    </div>
  );
}
