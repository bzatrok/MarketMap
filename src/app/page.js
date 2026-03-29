'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import dynamic from 'next/dynamic';
import Sidebar from '@/components/Sidebar';
import SearchInput from '@/components/SearchInput';
import FilterBar from '@/components/FilterBar';
import MarketCard from '@/components/MarketCard';
import { isMarketOpenNow } from '@/lib/filters';

const Map = dynamic(() => import('@/components/Map'), { ssr: false });

export default function HomePage() {
  const [markets, setMarkets] = useState([]);
  const [query, setQuery] = useState('');
  const [selectedDays, setSelectedDays] = useState([]);
  const [selectedProvinces, setSelectedProvinces] = useState([]);
  const [selectedType, setSelectedType] = useState('');
  const [openNow, setOpenNow] = useState(false);
  const [selectedMarket, setSelectedMarket] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [loading, setLoading] = useState(true);

  const fetchMarkets = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (query) params.set('q', query);
    if (selectedDays.length) params.set('days', selectedDays.join(','));
    if (selectedProvinces.length) params.set('provinces', selectedProvinces.join(','));
    if (selectedType) params.set('type', selectedType);

    const res = await fetch(`/api/markets?${params}`);
    const data = await res.json();
    setMarkets(data.hits || []);
    setLoading(false);
  }, [query, selectedDays, selectedProvinces, selectedType]);

  useEffect(() => {
    fetchMarkets();
  }, [fetchMarkets]);

  const filteredMarkets = useMemo(() => {
    if (!openNow) return markets;
    return markets.filter((m) => isMarketOpenNow(m.schedule));
  }, [markets, openNow]);

  const handleMarkerClick = useCallback((market) => {
    setSelectedMarket({ ...market, _ts: Date.now() });
  }, []);

  return (
    <div className="relative w-full h-full">
      <Sidebar open={sidebarOpen} onToggle={setSidebarOpen}>
        <SearchInput value={query} onChange={setQuery} />
        <FilterBar
          selectedDays={selectedDays}
          onDaysChange={setSelectedDays}
          selectedProvinces={selectedProvinces}
          onProvincesChange={setSelectedProvinces}
          openNow={openNow}
          onOpenNowChange={setOpenNow}
          selectedType={selectedType}
          onTypeChange={setSelectedType}
        />
        <div>
          <div className="text-xs text-gray-500 mb-2">
            {loading ? 'Laden...' : `${filteredMarkets.length} markten gevonden`}
          </div>
          <div className="space-y-2">
            {filteredMarkets.map((m) => (
              <MarketCard key={m.id} market={m} onClick={handleMarkerClick} />
            ))}
          </div>
        </div>
      </Sidebar>
      <Map
        markets={filteredMarkets}
        onMarkerClick={handleMarkerClick}
        selectedMarket={selectedMarket}
        selectedProvinces={selectedProvinces}
        sidebarOpen={sidebarOpen}
      />
    </div>
  );
}
