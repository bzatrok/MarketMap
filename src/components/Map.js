'use client';

import { useRef, useEffect } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { MAP_DEFAULTS } from '@/lib/constants';
import { DAY_LABELS } from '@/lib/constants';

const PROVINCE_SOURCE = 'provinces';
const PROVINCE_FILL_LAYER = 'province-fill';
const PROVINCE_LINE_LAYER = 'province-line';

function buildPopupHTML(market) {
  const scheduleLines = market.schedule
    .map((s) => `${DAY_LABELS[s.day] || s.day} · ${s.timeStart}–${s.timeEnd}`)
    .join('<br/>');
  const locationLine = [market.location, market.cityTown].filter(Boolean).join(', ');
  const navUrl = `https://www.google.com/maps/dir/?api=1&destination=${market._geo.lat},${market._geo.lng}`;

  return `<div style="font-size:13px;max-width:220px">
    <strong>${market.name}</strong><br/>
    ${scheduleLines}
    ${locationLine ? `<br/><span style="color:#666">${locationLine}</span>` : ''}
    ${market.url ? `<br/><a href="${market.url}" target="_blank" rel="noopener" style="color:#2563eb;text-decoration:underline;font-size:12px">Website →</a>` : ''}
    ${market.sourceUrl ? `<br/><a href="${market.sourceUrl}" target="_blank" rel="noopener" style="color:#2563eb;text-decoration:underline;font-size:12px">Source →</a>` : ''}
    ${market.municipalityUrl ? `<br/><a href="${market.municipalityUrl}" target="_blank" rel="noopener" style="color:#2563eb;text-decoration:underline;font-size:12px">Municipality →</a>` : ''}
    <br/><a href="${navUrl}" target="_blank" rel="noopener" style="color:#2563eb;text-decoration:underline;font-size:12px">Navigate →</a>
  </div>`;
}

export default function Map({ markets = [], onMarkerClick, selectedMarket, selectedProvinces = [], sidebarOpen = true }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef([]);
  const popupsRef = useRef(new globalThis.Map());
  const provinceLayersReady = useRef(false);

  // Initialize map + province layers
  useEffect(() => {
    if (mapRef.current) return;

    const key = process.env.NEXT_PUBLIC_MAPTILER_KEY;
    const styleUrl = `https://api.maptiler.com/maps/bright-v2/style.json?key=${key}`;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: styleUrl,
      center: [MAP_DEFAULTS.center[1], MAP_DEFAULTS.center[0]],
      zoom: MAP_DEFAULTS.zoom,
    });

    map.addControl(new maplibregl.NavigationControl(), 'top-right');

    map.on('load', () => {
      map.addSource(PROVINCE_SOURCE, {
        type: 'geojson',
        data: '/nl-provinces.geojson',
      });

      // Fill layer — grey by default, uses feature-state for color
      map.addLayer({
        id: PROVINCE_FILL_LAYER,
        type: 'fill',
        source: PROVINCE_SOURCE,
        paint: {
          'fill-color': [
            'case',
            ['boolean', ['feature-state', 'selected'], false],
            'rgba(37, 99, 235, 0.10)',
            'rgba(156, 163, 175, 0.10)',
          ],
          'fill-opacity': 1,
        },
      });

      // Border layer
      map.addLayer({
        id: PROVINCE_LINE_LAYER,
        type: 'line',
        source: PROVINCE_SOURCE,
        paint: {
          'line-color': [
            'case',
            ['boolean', ['feature-state', 'selected'], false],
            'rgba(37, 99, 235, 0.50)',
            'rgba(156, 163, 175, 0.40)',
          ],
          'line-width': 1.5,
        },
      });

      provinceLayersReady.current = true;
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      provinceLayersReady.current = false;
    };
  }, []);

  // Update province highlighting when selection changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    let hasFitted = false;

    function fitToSelection(features) {
      if (hasFitted) return;

      if (selectedProvinces.length > 0) {
        let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity;
        let found = false;

        features.forEach((f) => {
          if (!selectedProvinces.includes(f.properties.name)) return;
          found = true;

          const processCoord = ([lng, lat]) => {
            if (lng < minLng) minLng = lng;
            if (lng > maxLng) maxLng = lng;
            if (lat < minLat) minLat = lat;
            if (lat > maxLat) maxLat = lat;
          };

          const geom = f.geometry;
          if (geom.type === 'Polygon') {
            geom.coordinates.forEach((ring) => ring.forEach(processCoord));
          } else if (geom.type === 'MultiPolygon') {
            geom.coordinates.forEach((poly) => poly.forEach((ring) => ring.forEach(processCoord)));
          }
        });

        if (found && isFinite(minLng)) {
          map.fitBounds([[minLng, minLat], [maxLng, maxLat]], { padding: 40 });
          hasFitted = true;
        }
      } else {
        map.flyTo({
          center: [MAP_DEFAULTS.center[1], MAP_DEFAULTS.center[0]],
          zoom: MAP_DEFAULTS.zoom,
        });
        hasFitted = true;
      }
    }

    function updateProvinceStates() {
      if (!provinceLayersReady.current) return;

      const source = map.getSource(PROVINCE_SOURCE);
      if (!source) return;

      const features = map.querySourceFeatures(PROVINCE_SOURCE);
      features.forEach((f) => {
        map.setFeatureState(
          { source: PROVINCE_SOURCE, id: f.id },
          { selected: selectedProvinces.includes(f.properties.name) }
        );
      });

      fitToSelection(features);
    }

    // If map style is already loaded, update immediately
    if (map.isStyleLoaded()) {
      // Small delay to ensure source features are queryable after initial load
      setTimeout(updateProvinceStates, 100);
    }

    // Also update after any source data loads (handles initial GeoJSON fetch)
    map.on('sourcedata', function onSourceData(e) {
      if (e.sourceId === PROVINCE_SOURCE && e.isSourceLoaded) {
        updateProvinceStates();
        map.off('sourcedata', onSourceData);
      }
    });

    // Update on idle (catches viewport changes that load new tiles)
    const onIdle = () => updateProvinceStates();
    map.on('idle', onIdle);

    return () => {
      map.off('idle', onIdle);
    };
  }, [selectedProvinces]);

  // Update markers when markets change
  useEffect(() => {
    if (!mapRef.current) return;

    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];
    popupsRef.current.clear();

    markets.forEach((market) => {
      if (!market._geo) return;

      const popup = new maplibregl.Popup({ offset: 25 }).setHTML(
        buildPopupHTML(market)
      );

      const marker = new maplibregl.Marker({ color: '#2563eb' })
        .setLngLat([market._geo.lng, market._geo.lat])
        .setPopup(popup)
        .addTo(mapRef.current);

      marker.getElement().addEventListener('click', () => {
        onMarkerClick?.(market);
      });

      markersRef.current.push(marker);
      popupsRef.current.set(market.id, marker);
    });

    // Fit map viewport to results
    const withGeo = markets.filter((m) => m._geo);
    const pad = { top: 60, bottom: 60, left: sidebarOpen ? 420 : 60, right: 60 };

    if (withGeo.length >= 2) {
      let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity;
      withGeo.forEach(({ _geo }) => {
        if (_geo.lng < minLng) minLng = _geo.lng;
        if (_geo.lng > maxLng) maxLng = _geo.lng;
        if (_geo.lat < minLat) minLat = _geo.lat;
        if (_geo.lat > maxLat) maxLat = _geo.lat;
      });
      mapRef.current.fitBounds([[minLng, minLat], [maxLng, maxLat]], { padding: pad });
    } else if (withGeo.length === 1) {
      mapRef.current.flyTo({
        center: [withGeo[0]._geo.lng, withGeo[0]._geo.lat],
        zoom: 14,
        padding: pad,
      });
    } else {
      mapRef.current.flyTo({
        center: [MAP_DEFAULTS.center[1], MAP_DEFAULTS.center[0]],
        zoom: MAP_DEFAULTS.zoom,
        padding: { top: 0, bottom: 0, left: sidebarOpen ? 380 : 0, right: 0 },
      });
    }
  }, [markets, onMarkerClick, sidebarOpen]);

  // Fly to selected market and open its popup
  useEffect(() => {
    if (!mapRef.current || !selectedMarket?._geo) return;

    const marker = popupsRef.current.get(selectedMarket.id);

    mapRef.current.flyTo({
      center: [selectedMarket._geo.lng, selectedMarket._geo.lat],
      zoom: 14,
      duration: 1000,
    });

    if (marker) {
      markersRef.current.forEach((m) => {
        if (m.getPopup()?.isOpen()) m.togglePopup();
      });
      if (!marker.getPopup()?.isOpen()) {
        marker.togglePopup();
      }
    }
  }, [selectedMarket]);

  return <div ref={containerRef} className="w-full h-full" />;
}
