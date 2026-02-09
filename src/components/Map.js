'use client';

import { useRef, useEffect } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { MAP_DEFAULTS } from '@/lib/constants';
import { DAY_LABELS } from '@/lib/constants';

export default function Map({ markets = [], onMarkerClick }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef([]);

  // Initialize map
  useEffect(() => {
    if (mapRef.current) return;

    const key = process.env.NEXT_PUBLIC_MAPTILER_KEY;
    const styleUrl = `https://api.maptiler.com/maps/bright-v2/style.json?key=${key}`;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: styleUrl,
      center: [MAP_DEFAULTS.center[1], MAP_DEFAULTS.center[0]], // MapLibre uses [lng, lat]
      zoom: MAP_DEFAULTS.zoom,
    });

    map.addControl(new maplibregl.NavigationControl(), 'top-right');
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Update markers when markets change
  useEffect(() => {
    if (!mapRef.current) return;

    // Clear existing markers
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    markets.forEach((market) => {
      if (!market._geo) return;

      const dayLabel = market.schedule.days.map((d) => DAY_LABELS[d] || d).join(', ');
      const popup = new maplibregl.Popup({ offset: 25 }).setHTML(
        `<div style="font-size:13px">
          <strong>${market.name}</strong><br/>
          <span>${dayLabel} · ${market.schedule.timeStart}–${market.schedule.timeEnd}</span>
        </div>`
      );

      const marker = new maplibregl.Marker({ color: '#2563eb' })
        .setLngLat([market._geo.lng, market._geo.lat])
        .setPopup(popup)
        .addTo(mapRef.current);

      marker.getElement().addEventListener('click', () => {
        onMarkerClick?.(market);
      });

      markersRef.current.push(marker);
    });
  }, [markets, onMarkerClick]);

  return <div ref={containerRef} className="w-full h-full" />;
}
