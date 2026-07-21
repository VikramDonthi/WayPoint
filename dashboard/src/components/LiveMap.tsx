import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Rider } from '../types';

interface LiveMapProps {
  riders: Rider[];
  onSelectRider?: (rider: Rider) => void;
}

export const LiveMap: React.FC<LiveMapProps> = ({ riders, onSelectRider }) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<{ [riderId: string]: L.Marker }>({});

  useEffect(() => {
    if (!mapRef.current) return;

    if (!leafletMapRef.current) {
      // Default initial view (e.g. New Delhi / India center fallback or first rider position)
      const map = L.map(mapRef.current).setView([28.6139, 77.2090], 12);

      // OpenStreetMap Tiles (100% Free, zero budget cost)
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19
      }).addTo(map);

      leafletMapRef.current = map;
    }

    const map = leafletMapRef.current;
    const currentMarkers = markersRef.current;
    const validPositions: L.LatLngExpression[] = [];

    // Helper to generate colored marker SVG icon
    const createMarkerIcon = (status: Rider['status'], name: string) => {
      let color = '#64748b'; // offline
      if (status === 'traveling') color = '#10b981';  // Green
      if (status === 'delivering') color = '#00f2fe'; // Cyan / Blue (At Customer Drop)
      if (status === 'resting') color = '#f59e0b';    // Amber (Break Time)

      const svgHtml = `
        <div style="
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 36px;
          height: 36px;
          background: #0b0f17;
          border: 2px solid ${color};
          border-radius: 50%;
          box-shadow: 0 0 15px ${color}80;
          color: #ffffff;
          font-weight: bold;
          font-size: 12px;
          font-family: sans-serif;
        ">
          ${name.substring(0, 1).toUpperCase()}
          <span style="
            position: absolute;
            bottom: -2px;
            right: -2px;
            width: 10px;
            height: 10px;
            background-color: ${color};
            border: 2px solid #0b0f17;
            border-radius: 50%;
          "></span>
        </div>
      `;

      return L.divIcon({
        html: svgHtml,
        className: 'custom-rider-pin',
        iconSize: [36, 36],
        iconAnchor: [18, 18]
      });
    };

    // Update markers
    riders.forEach((rider) => {
      if (rider.lastLocation && rider.lastLocation.lat && rider.lastLocation.lng) {
        const position: [number, number] = [rider.lastLocation.lat, rider.lastLocation.lng];
        validPositions.push(position);

        const icon = createMarkerIcon(rider.status, rider.name);
        const popupContent = `
          <div style="font-family: sans-serif; padding: 4px;">
            <strong style="font-size: 14px; color: #f8fafc;">${rider.name}</strong><br/>
            <span style="font-size: 12px; color: #38bdf8;">Mobile: ${rider.phone}</span><br/>
            <span style="font-size: 11px; color: #94a3b8;">Status: <strong style="color: ${rider.status === 'traveling' ? '#10b981' : rider.status === 'delivering' ? '#00f2fe' : rider.status === 'resting' ? '#f59e0b' : '#64748b'}">${rider.status.toUpperCase()}</strong></span>
          </div>
        `;

        if (currentMarkers[rider.id]) {
          currentMarkers[rider.id].setLatLng(position);
          currentMarkers[rider.id].setIcon(icon);
          currentMarkers[rider.id].setPopupContent(popupContent);
        } else {
          const marker = L.marker(position, { icon }).addTo(map);
          marker.bindPopup(popupContent);
          marker.on('click', () => {
            if (onSelectRider) onSelectRider(rider);
          });
          currentMarkers[rider.id] = marker;
        }
      }
    });

    // Auto fit map bounds if riders exist
    if (validPositions.length > 0 && map) {
      const bounds = L.latLngBounds(validPositions);
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
    }

  }, [riders, onSelectRider]);

  return (
    <div style={{
      position: 'relative',
      width: '100%',
      height: 'calc(100vh - 120px)',
      borderRadius: '16px',
      overflow: 'hidden',
      border: '1px solid rgba(255, 255, 255, 0.08)'
    }}>
      <div ref={mapRef} style={{ width: '100%', height: '100%' }} />

      {/* Map Legend Overlay */}
      <div style={{
        position: 'absolute',
        bottom: '20px',
        left: '20px',
        backgroundColor: 'rgba(19, 27, 41, 0.9)',
        backdropFilter: 'blur(8px)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        padding: '0.75rem 1rem',
        borderRadius: '12px',
        zIndex: 1000,
        display: 'flex',
        gap: '1rem',
        fontSize: '0.85rem',
        color: '#f8fafc'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#10b981' }} />
          <span>Traveling</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#00f2fe' }} />
          <span>At Delivery Stop (≤30m)</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#f59e0b' }} />
          <span>Resting (&gt;30m Break)</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#64748b' }} />
          <span>Offline</span>
        </div>
      </div>
    </div>
  );
};
