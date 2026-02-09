'use client';

import { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import Sidebar from '@/components/Sidebar';
import SearchInput from '@/components/SearchInput';
import FilterBar from '@/components/FilterBar';
import MarketCard from '@/components/MarketCard';

const Map = dynamic(() => import('@/components/Map'), { ssr: false });

export default function HomePage() {
  const [markets, setMarkets] = useState([]);
  const [query, setQuery] = useState('');
  const [selectedDays, setSelectedDays] = useState([]);
  const [selectedProvinces, setSelectedProvinces] = useState([]);
  const [selectedMarket, setSelectedMarket] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchMarkets = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (query) params.set('q', query);
    if (selectedDays.length) params.set('days', selectedDays.join(','));
    if (selectedProvinces.length) params.set('provinces', selectedProvinces.join(','));

    const res = await fetch(`/api/markets?${params}`);
    const data = await res.json();
    setMarkets(data.hits || []);
    setLoading(false);
  }, [query, selectedDays, selectedProvinces]);

  useEffect(() => {
    fetchMarkets();
  }, [fetchMarkets]);

  const handleMarkerClick = useCallback((market) => {
    setSelectedMarket(market);
  }, []);

  return (
    <div className="relative w-full h-full">
      <Sidebar>
        <SearchInput value={query} onChange={setQuery} />
        <FilterBar
          selectedDays={selectedDays}
          onDaysChange={setSelectedDays}
          selectedProvinces={selectedProvinces}
          onProvincesChange={setSelectedProvinces}
        />
        <div>
          <div className="text-xs text-gray-500 mb-2">
            {loading ? 'Loading...' : `${markets.length} markets found`}
          </div>
          <div className="space-y-2">
            {markets.map((m) => (
              <MarketCard key={m.id} market={m} onClick={handleMarkerClick} />
            ))}
          </div>
        </div>
      </Sidebar>
      <Map
        markets={markets}
        onMarkerClick={handleMarkerClick}
        selectedMarket={selectedMarket}
        selectedProvinces={selectedProvinces}
      />
    </div>
  );
}
