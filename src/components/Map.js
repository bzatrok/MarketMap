'use client';

import { useRef, useEffect, useCallback } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import Supercluster from 'supercluster';
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
    <a href="/markets/${market.id}" style="font-weight:600;color:#111;text-decoration:none">${market.name}</a><br/>
    ${scheduleLines}
    ${locationLine ? `<br/><span style="color:#666">${locationLine}</span>` : ''}
    <div style="margin-top:6px;display:flex;flex-wrap:wrap;gap:4px 10px;font-size:12px">
      <a href="/markets/${market.id}" style="color:#2563eb;text-decoration:underline">Details →</a>
      <a href="${navUrl}" target="_blank" rel="noopener" style="color:#2563eb;text-decoration:underline">Route →</a>
      ${market.url ? `<a href="${market.url}" target="_blank" rel="noopener" style="color:#2563eb;text-decoration:underline">Website →</a>` : ''}
    </div>
  </div>`;
}

function createClusterElement(count) {
  const size = count < 10 ? 32 : count < 50 ? 40 : 48;
  const el = document.createElement('div');
  el.style.cssText = `
    width:${size}px;height:${size}px;border-radius:50%;
    background:#2563eb;color:white;font-size:13px;font-weight:600;
    display:flex;align-items:center;justify-content:center;
    border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3);
    cursor:pointer;
  `;
  el.textContent = count;
  return el;
}

export default function Map({ markets = [], onMarkerClick, selectedMarket, selectedProvinces = [], sidebarOpen = true }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef([]);
  const popupsRef = useRef(new globalThis.Map());
  const clusterRef = useRef(null);
  const marketsRef = useRef([]);
  const activePopupId = useRef(null);
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

  // Render visible clusters/markers for the current viewport
  const renderMarkers = useCallback(() => {
    const map = mapRef.current;
    const cluster = clusterRef.current;
    if (!map || !cluster) return;

    // Clear existing markers
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];
    popupsRef.current.clear();

    const bounds = map.getBounds();
    const zoom = Math.floor(map.getZoom());
    const bbox = [bounds.getWest(), bounds.getSouth(), bounds.getEast(), bounds.getNorth()];
    const clusters = cluster.getClusters(bbox, zoom);

    clusters.forEach((feature) => {
      const [lng, lat] = feature.geometry.coordinates;

      if (feature.properties.cluster) {
        // Cluster marker
        const count = feature.properties.point_count;
        const el = createClusterElement(count);
        el.addEventListener('click', () => {
          const expansionZoom = Math.min(cluster.getClusterExpansionZoom(feature.id), 20);
          map.flyTo({ center: [lng, lat], zoom: expansionZoom, duration: 500 });
        });

        const marker = new maplibregl.Marker({ element: el })
          .setLngLat([lng, lat])
          .addTo(map);
        markersRef.current.push(marker);
      } else {
        // Individual market marker
        const market = feature.properties;
        const popup = new maplibregl.Popup({ offset: 25 }).setHTML(
          buildPopupHTML(market)
        );

        const marker = new maplibregl.Marker({ color: '#2563eb' })
          .setLngLat([lng, lat])
          .setPopup(popup)
          .addTo(map);

        marker.getElement().addEventListener('click', () => {
          onMarkerClick?.(market);
        });

        markersRef.current.push(marker);
        popupsRef.current.set(market.id, marker);
      }
    });

    // Re-open popup for the active market after re-render
    if (activePopupId.current) {
      const activeMarker = popupsRef.current.get(activePopupId.current);
      if (activeMarker && !activeMarker.getPopup()?.isOpen()) {
        activeMarker.togglePopup();
      }
    }
  }, [onMarkerClick]);

  // Update supercluster index and fit viewport when markets change
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Build GeoJSON features for supercluster
    const withGeo = markets.filter((m) => m._geo);
    marketsRef.current = withGeo;

    const points = withGeo.map((market) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [market._geo.lng, market._geo.lat] },
      properties: { ...market },
    }));

    const cluster = new Supercluster({ radius: 60, maxZoom: 16 });
    cluster.load(points);
    clusterRef.current = cluster;

    // Fit map viewport to results
    const pad = { top: 60, bottom: 60, left: sidebarOpen ? 420 : 60, right: 60 };

    if (withGeo.length >= 2) {
      let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity;
      withGeo.forEach(({ _geo }) => {
        if (_geo.lng < minLng) minLng = _geo.lng;
        if (_geo.lng > maxLng) maxLng = _geo.lng;
        if (_geo.lat < minLat) minLat = _geo.lat;
        if (_geo.lat > maxLat) maxLat = _geo.lat;
      });
      map.fitBounds([[minLng, minLat], [maxLng, maxLat]], { padding: pad });
    } else if (withGeo.length === 1) {
      map.flyTo({
        center: [withGeo[0]._geo.lng, withGeo[0]._geo.lat],
        zoom: 14,
        padding: pad,
      });
    } else {
      map.flyTo({
        center: [MAP_DEFAULTS.center[1], MAP_DEFAULTS.center[0]],
        zoom: MAP_DEFAULTS.zoom,
        padding: { top: 0, bottom: 0, left: sidebarOpen ? 380 : 0, right: 0 },
      });
    }

    // Render after viewport settles
    renderMarkers();

    // Re-render on zoom/pan
    const onMoveEnd = () => renderMarkers();
    map.on('moveend', onMoveEnd);
    return () => map.off('moveend', onMoveEnd);
  }, [markets, sidebarOpen, renderMarkers]);

  // Fly to selected market and open its popup
  useEffect(() => {
    if (!mapRef.current || !selectedMarket?._geo) return;

    // Track which popup should stay open (renderMarkers will handle opening it)
    activePopupId.current = selectedMarket.id;

    // Close all currently open popups
    markersRef.current.forEach((m) => {
      if (m.getPopup()?.isOpen()) m.togglePopup();
    });

    mapRef.current.flyTo({
      center: [selectedMarket._geo.lng, selectedMarket._geo.lat],
      zoom: 14,
      duration: 1000,
    });
  }, [selectedMarket]);

  return <div ref={containerRef} className="w-full h-full" />;
}
