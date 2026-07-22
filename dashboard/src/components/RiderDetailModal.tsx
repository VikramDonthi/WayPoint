import React, { useEffect, useState, useRef } from 'react';
import {
  X, Clock, Navigation, Activity, Bike,
  TrendingUp, BarChart2
} from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Rider, Shift, PingPoint } from '../types';
import { db } from '../firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';

interface Props {
  rider: Rider | null;
  onClose: () => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toDate(ts: any): Date {
  if (!ts) return new Date(0);
  if (ts?.toDate) return ts.toDate();
  return new Date(ts);
}

function fmtDate(ts: any) {
  return toDate(ts).toLocaleString('en-IN', {
    dateStyle: 'medium', timeStyle: 'short'
  });
}

function fmtDuration(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const statusColor: Record<string, string> = {
  traveling: '#10b981',
  delivering: '#3b82f6',
  resting: '#f59e0b',
};

// ─── Shift History Map ─────────────────────────────────────────────────────────

interface ShiftMapProps {
  pings: PingPoint[];
  isOngoing?: boolean;
}

const ShiftMap: React.FC<ShiftMapProps> = ({ pings, isOngoing }) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!mapRef.current || pings.length === 0) return;

    if (!leafletRef.current) {
      leafletRef.current = L.map(mapRef.current).setView(
        [pings[0].lat, pings[0].lng], 14
      );
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(leafletRef.current);
    }

    const map = leafletRef.current;

    // Clear previous layers (except tile)
    map.eachLayer((layer) => {
      if (!(layer instanceof L.TileLayer)) map.removeLayer(layer);
    });

    // Draw polyline path
    const coords: L.LatLngExpression[] = pings.map(p => [p.lat, p.lng]);
    L.polyline(coords, { color: '#0284c7', weight: 2.5, opacity: 0.7 }).addTo(map);

    // Draw color-coded circle markers
    pings.forEach((p, i) => {
      const color = statusColor[p.movementType] || '#64748b';
      const radius = p.movementType === 'resting' ? 7 : p.movementType === 'delivering' ? 7 : 5;

      const circle = L.circleMarker([p.lat, p.lng], {
        radius,
        fillColor: color,
        color: '#fff',
        weight: 1.5,
        opacity: 1,
        fillOpacity: 0.9,
      }).addTo(map);

      circle.bindPopup(`
        <div style="font-family:sans-serif;min-width:160px">
          <strong style="color:#0f172a">${p.movementType.charAt(0).toUpperCase() + p.movementType.slice(1)}</strong><br/>
          <span style="font-size:11px;color:#64748b">${fmtDate(p.timestamp)}</span><br/>
          <span style="font-size:11px">${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}</span><br/>
          <span style="font-size:11px">Speed: ${p.speed ? (p.speed * 3.6).toFixed(1) : '0.0'} km/h</span>
          ${i === 0 ? '<br/><strong style="color:#10b981">Start</strong>' : ''}
          ${i === pings.length - 1 ? '<br/><strong style="color:#ef4444">End</strong>' : ''}
        </div>
      `);
    });

    // Start & end/live markers
    if (pings.length > 0) {
      L.marker([pings[0].lat, pings[0].lng], {
        icon: L.divIcon({
          html: `<div style="background:#10b981;color:#fff;padding:2px 6px;border-radius:8px;font-size:11px;font-weight:700;white-space:nowrap;box-shadow:0 2px 6px rgba(0,0,0,0.2)">START</div>`,
          iconAnchor: [20, 10],
          className: ''
        })
      }).addTo(map);

      const lastBadgeBg = isOngoing ? '#0284c7' : '#ef4444';
      const lastBadgeLabel = isOngoing ? 'LIVE' : 'END';

      L.marker([pings[pings.length - 1].lat, pings[pings.length - 1].lng], {
        icon: L.divIcon({
          html: `<div style="background:${lastBadgeBg};color:#fff;padding:2px 6px;border-radius:8px;font-size:11px;font-weight:700;white-space:nowrap;box-shadow:0 2px 6px rgba(0,0,0,0.2)">${lastBadgeLabel}</div>`,
          iconAnchor: [14, 10],
          className: ''
        })
      }).addTo(map);
    }

    // Fit bounds
    map.fitBounds(L.latLngBounds(coords), { padding: [32, 32] });

    return () => {
      // Don't destroy map on pings change, just re-render
    };
  }, [pings]);

  useEffect(() => {
    return () => {
      if (leafletRef.current) {
        leafletRef.current.remove();
        leafletRef.current = null;
      }
    };
  }, []);

  return (
    <div
      ref={mapRef}
      style={{
        width: '100%',
        height: '300px',
        borderRadius: '14px',
        overflow: 'hidden',
        border: '1.5px solid #e2e8f0',
        zIndex: 1
      }}
    />
  );
};

// ─── Main Modal ───────────────────────────────────────────────────────────────

export const RiderDetailModal: React.FC<Props> = ({ rider, onClose }) => {
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [selectedShift, setSelectedShift] = useState<Shift | null>(null);
  const [pings, setPings] = useState<PingPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [pingsLoading, setPingsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'timeline' | 'map'>('overview');

  interface Stats {
    travelKm: number;
    travelSec: number;
    restSec: number;
    deliverSec: number;
    avgSpeedKmh: number;
    maxSpeedKmh: number;
    shiftDurationSec: number;
  }

  const [stats, setStats] = useState<Stats>({
    travelKm: 0, travelSec: 0, restSec: 0, deliverSec: 0,
    avgSpeedKmh: 0, maxSpeedKmh: 0, shiftDurationSec: 0
  });

  // Real-time Shifts listener
  useEffect(() => {
    if (!rider || !db) return;
    setLoading(true);

    const q = query(
      collection(db!, 'shifts'),
      where('riderId', '==', rider.id)
    );

    const unsubscribe = onSnapshot(q, (snap) => {
      const list: Shift[] = snap.docs
        .map(d => ({ id: d.id, ...d.data() } as Shift))
        .sort((a, b) => toDate(b.startTime).getTime() - toDate(a.startTime).getTime());

      setShifts(list);
      setSelectedShift(prev => {
        if (!prev && list.length > 0) return list[0];
        if (prev) {
          const updated = list.find(s => s.id === prev.id);
          return updated || list[0] || null;
        }
        return null;
      });
      setLoading(false);
    }, (err) => {
      console.error('Error in shifts real-time listener:', err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [rider]);

  // Real-time Pings listener when shift selected
  useEffect(() => {
    if (!selectedShift || !db) {
      setPings([]);
      return;
    }
    setPingsLoading(true);

    const colRef = collection(db!, 'shifts', selectedShift.id, 'points');
    const unsubscribe = onSnapshot(colRef, (snap) => {
      const list: PingPoint[] = snap.docs
        .map(d => ({ id: d.id, ...d.data() } as PingPoint))
        .sort((a, b) => toDate(a.timestamp).getTime() - toDate(b.timestamp).getTime());

      setPings(list);

      // Compute stats live from pings
      let travelKm = 0, travelSec = 0, restSec = 0, deliverSec = 0;
      let speedSum = 0, maxSpeedKmh = 0, speedCount = 0;

      for (let i = 1; i < list.length; i++) {
        const prev = list[i - 1];
        const curr = list[i];
        const dtSec = Math.max(0, (toDate(curr.timestamp).getTime() - toDate(prev.timestamp).getTime()) / 1000);
        const dist = haversineKm(prev.lat, prev.lng, curr.lat, curr.lng);
        const spd = dtSec > 0 ? (dist / dtSec) * 3600 : 0; // km/h

        if (curr.movementType === 'traveling') {
          travelSec += dtSec;
          travelKm += dist;
          speedSum += spd;
          speedCount++;
          if (spd > maxSpeedKmh) maxSpeedKmh = spd;
        } else if (curr.movementType === 'delivering') {
          deliverSec += dtSec;
        } else {
          restSec += dtSec;
        }
      }

      const startT = list.length > 0 ? toDate(list[0].timestamp).getTime() : 0;
      const endT   = list.length > 0 ? toDate(list[list.length - 1].timestamp).getTime() : 0;

      const storedKm = parseFloat(Number(selectedShift.totalDistanceKm || 0).toFixed(3));
      const derivedKm = parseFloat(travelKm.toFixed(3));

      setStats({
        travelKm: derivedKm > 0.001 ? derivedKm : storedKm,
        travelSec: Math.round(travelSec),
        restSec: Math.round(restSec),
        deliverSec: Math.round(deliverSec),
        avgSpeedKmh: speedCount > 0 ? parseFloat((speedSum / speedCount).toFixed(1)) : 0,
        maxSpeedKmh: parseFloat(maxSpeedKmh.toFixed(1)),
        shiftDurationSec: Math.round((endT - startT) / 1000)
      });

      setPingsLoading(false);
    }, (err) => {
      console.error('[WP] Error in pings real-time listener:', err);
      setPingsLoading(false);
    });

    return () => unsubscribe();
  }, [selectedShift]);

  if (!rider) return null;

  const statusBadge = {
    traveling: { bg: '#dcfce7', color: '#166534', label: 'Traveling' },
    resting: { bg: '#fef9c3', color: '#854d0e', label: 'Resting' },
    delivering: { bg: '#dbeafe', color: '#1e40af', label: 'Delivering' },
    offline: { bg: '#f1f5f9', color: '#475569', label: 'Offline' },
  }[rider.status] || { bg: '#f1f5f9', color: '#475569', label: rider.status };

  const travelPct = stats.shiftDurationSec > 0 ? Math.round((stats.travelSec / stats.shiftDurationSec) * 100) : 0;
  const restPct = stats.shiftDurationSec > 0 ? Math.round((stats.restSec / stats.shiftDurationSec) * 100) : 0;
  const deliverPct = stats.shiftDurationSec > 0 ? Math.round((stats.deliverSec / stats.shiftDurationSec) * 100) : 0;

  return (
    <div
      onClick={e => e.target === e.currentTarget && onClose()}
      style={{
        position: 'fixed', inset: 0,
        backgroundColor: 'rgba(15,23,42,0.55)',
        backdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        zIndex: 2000, padding: '1rem', overflowY: 'auto'
      }}
    >
      <div style={{
        backgroundColor: '#fff',
        borderRadius: '24px',
        width: '100%',
        maxWidth: '900px',
        boxShadow: '0 32px 64px rgba(0,0,0,0.18)',
        marginTop: '2rem',
        marginBottom: '2rem',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}>

        {/* ── Header ── */}
        <div style={{
          background: 'linear-gradient(135deg,#0f172a 0%,#0284c7 100%)',
          padding: '1.75rem 2rem',
          display: 'flex', alignItems: 'center', gap: '1.25rem',
          position: 'relative'
        }}>
          <div style={{
            width: '62px', height: '62px', borderRadius: '18px',
            background: 'rgba(255,255,255,0.18)',
            border: '2px solid rgba(255,255,255,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '1.6rem', fontWeight: '900', color: '#fff',
            flexShrink: 0
          }}>
            {rider.name.charAt(0).toUpperCase()}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '4px' }}>
              <h2 style={{ fontSize: '1.45rem', fontWeight: '800', color: '#fff', margin: 0 }}>{rider.name}</h2>
              <span style={{
                background: statusBadge.bg, color: statusBadge.color,
                fontSize: '0.72rem', fontWeight: '700', borderRadius: '99px',
                padding: '2px 10px', letterSpacing: '0.03em'
              }}>{statusBadge.label}</span>
            </div>
            <div style={{ display: 'flex', gap: '1.2rem', fontSize: '0.82rem', color: 'rgba(255,255,255,0.7)' }}>
              <span>Mobile: {rider.phone}</span>
              <span>{Number(rider.totalDistanceKm || 0).toFixed(3)} km lifetime</span>
              <span>{shifts.length} shifts total</span>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              position: 'absolute', top: '1.25rem', right: '1.25rem',
              background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff',
              borderRadius: '50%', width: '36px', height: '36px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', transition: 'background 0.2s'
            }}
            onMouseOver={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.25)')}
            onMouseOut={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.15)')}
          >
            <X size={16} />
          </button>
        </div>

        {/* ── Body: Shifts sidebar + detail pane ── */}
        <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>

          {/* Shifts sidebar */}
          <div style={{
            width: '220px', flexShrink: 0,
            borderRight: '1px solid #f1f5f9',
            padding: '1.25rem 0.75rem',
            overflowY: 'auto',
            background: '#f8fafc',
          }}>
            <p style={{ fontSize: '0.72rem', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.75rem', paddingLeft: '0.5rem' }}>
              Shift History
            </p>
            {loading ? (
              <p style={{ fontSize: '0.82rem', color: '#94a3b8', padding: '0.5rem' }}>Loading…</p>
            ) : shifts.length === 0 ? (
              <p style={{ fontSize: '0.82rem', color: '#94a3b8', padding: '0.5rem' }}>No shifts yet.</p>
            ) : (
              shifts.map(shift => {
                const isActive = selectedShift?.id === shift.id;
                const start = toDate(shift.startTime);
                const end = shift.endTime ? toDate(shift.endTime) : null;
                const durMs = end ? end.getTime() - start.getTime() : 0;
                const durH = (durMs / 3600000).toFixed(1);
                return (
                  <button
                    key={shift.id}
                    onClick={() => { setSelectedShift(shift); setActiveTab('overview'); }}
                    style={{
                      width: '100%', textAlign: 'left', padding: '0.65rem 0.75rem',
                      borderRadius: '12px', border: '1.5px solid',
                      borderColor: isActive ? '#0284c7' : 'transparent',
                      backgroundColor: isActive ? 'rgba(2,132,199,0.08)' : 'transparent',
                      cursor: 'pointer', marginBottom: '4px',
                      transition: 'all 0.15s'
                    }}
                    onMouseOver={e => { if (!isActive) e.currentTarget.style.background = '#e2e8f0'; }}
                    onMouseOut={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
                  >
                    <div style={{ fontSize: '0.8rem', fontWeight: '700', color: isActive ? '#0284c7' : '#0f172a', marginBottom: '2px' }}>
                      {start.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                      {start.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })} — {end ? end.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : 'ongoing'}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '2px' }}>
                      {durH}h · {Number(shift.totalDistanceKm || 0).toFixed(3)} km
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {/* Detail pane */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
            {!selectedShift ? (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: '0.9rem' }}>
                Select a shift to see details
              </div>
            ) : (
              <>
                {/* Tab bar */}
                <div style={{
                  display: 'flex', gap: 0,
                  borderBottom: '1px solid #f1f5f9',
                  padding: '0 1.5rem'
                }}>
                  {(['overview', 'map', 'timeline'] as const).map(tab => (
                    <button key={tab} onClick={() => setActiveTab(tab)} style={{
                      padding: '1rem 1.25rem',
                      border: 'none', background: 'none',
                      fontWeight: '700', fontSize: '0.85rem',
                      color: activeTab === tab ? '#0284c7' : '#94a3b8',
                      borderBottom: `2.5px solid ${activeTab === tab ? '#0284c7' : 'transparent'}`,
                      cursor: 'pointer', transition: 'all 0.15s',
                      textTransform: 'capitalize'
                    }}>
                      {tab === 'overview' ? 'Overview' : tab === 'map' ? 'Map' : 'Timeline'}
                    </button>
                  ))}
                </div>

                <div style={{ flex: 1, padding: '1.5rem', overflowY: 'auto' }}>

                  {/* ── OVERVIEW TAB ── */}
                  {activeTab === 'overview' && (
                    <div>
                      {/* Shift info strip */}
                      <div style={{
                        background: 'linear-gradient(90deg,#f0f9ff,#e0f2fe)',
                        border: '1px solid #bae6fd',
                        borderRadius: '14px', padding: '1rem 1.25rem',
                        marginBottom: '1.25rem',
                        display: 'flex', flexWrap: 'wrap', gap: '1.5rem'
                      }}>
                        <div>
                          <div style={{ fontSize: '0.7rem', color: '#0284c7', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Start</div>
                          <div style={{ fontSize: '0.9rem', fontWeight: '700', color: '#0f172a' }}>{fmtDate(selectedShift.startTime)}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: '0.7rem', color: '#0284c7', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em' }}>End</div>
                          <div style={{ fontSize: '0.9rem', fontWeight: '700', color: '#0f172a' }}>{selectedShift.endTime ? fmtDate(selectedShift.endTime) : '— Ongoing —'}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: '0.7rem', color: '#0284c7', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Duration</div>
                          <div style={{ fontSize: '0.9rem', fontWeight: '700', color: '#0f172a' }}>{fmtDuration(stats.shiftDurationSec)}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: '0.7rem', color: '#0284c7', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Pings</div>
                          <div style={{ fontSize: '0.9rem', fontWeight: '700', color: '#0f172a' }}>{pings.length}</div>
                        </div>
                      </div>

                      {/* KPI grid */}
                      {pingsLoading ? (
                        <div style={{ color: '#94a3b8', fontSize: '0.85rem', textAlign: 'center', padding: '2rem' }}>Loading shift data…</div>
                      ) : (
                        <>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem', marginBottom: '1.25rem' }}>
                            {[
                              { icon: <Navigation size={18} />, label: 'Distance', value: `${Number(stats.travelKm || 0).toFixed(3)} km`, accent: '#0284c7' },
                              { icon: <Activity size={18} />, label: 'Avg Speed', value: `${stats.avgSpeedKmh} km/h`, accent: '#8b5cf6' },
                              { icon: <TrendingUp size={18} />, label: 'Max Speed', value: `${stats.maxSpeedKmh} km/h`, accent: '#ef4444' },
                              { icon: <Bike size={18} />, label: 'Moving Time', value: fmtDuration(stats.travelSec), accent: '#10b981' },
                              { icon: <Clock size={18} />, label: 'Resting Time', value: fmtDuration(stats.restSec), accent: '#f59e0b' },
                              { icon: <BarChart2 size={18} />, label: 'Delivery Stops', value: fmtDuration(stats.deliverSec), accent: '#3b82f6' },
                            ].map(card => (
                              <div key={card.label} style={{
                                background: '#f8fafc', border: '1.5px solid #e2e8f0',
                                borderRadius: '14px', padding: '0.9rem 1rem'
                              }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: card.accent, fontSize: '0.72rem', fontWeight: '700', marginBottom: '6px' }}>
                                  {card.icon} {card.label}
                                </div>
                                <div style={{ fontSize: '1.2rem', fontWeight: '800', color: '#0f172a' }}>{card.value}</div>
                              </div>
                            ))}
                          </div>

                          {/* Time breakdown bar */}
                          <div style={{ marginBottom: '1.25rem' }}>
                            <p style={{ fontSize: '0.75rem', fontWeight: '700', color: '#64748b', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Time Breakdown</p>
                            <div style={{ display: 'flex', borderRadius: '99px', overflow: 'hidden', height: '12px', background: '#f1f5f9' }}>
                              <div style={{ width: `${travelPct}%`, background: '#10b981', transition: 'width 0.5s' }} title={`Traveling: ${travelPct}%`} />
                              <div style={{ width: `${restPct}%`, background: '#f59e0b', transition: 'width 0.5s' }} title={`Resting: ${restPct}%`} />
                              <div style={{ width: `${deliverPct}%`, background: '#3b82f6', transition: 'width 0.5s' }} title={`Delivering: ${deliverPct}%`} />
                            </div>
                            <div style={{ display: 'flex', gap: '1rem', marginTop: '6px', fontSize: '0.72rem', color: '#64748b' }}>
                              <span><span style={{ color: '#10b981', fontWeight: '700' }}>■</span> Traveling {travelPct}%</span>
                              <span><span style={{ color: '#f59e0b', fontWeight: '700' }}>■</span> Resting {restPct}%</span>
                              <span><span style={{ color: '#3b82f6', fontWeight: '700' }}>■</span> Delivery {deliverPct}%</span>
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  )}

                  {/* ── MAP TAB ── */}
                  {activeTab === 'map' && (
                    <div>
                      {pingsLoading ? (
                        <div style={{ textAlign: 'center', color: '#94a3b8', padding: '3rem', fontSize: '0.85rem' }}>Loading map data…</div>
                      ) : pings.length === 0 ? (
                        <div style={{ textAlign: 'center', color: '#94a3b8', padding: '3rem', fontSize: '0.85rem' }}>No location points recorded.</div>
                      ) : (
                        <>
                          <ShiftMap pings={pings} isOngoing={!selectedShift.endTime} />
                          <div style={{ display: 'flex', gap: '1rem', marginTop: '0.75rem', flexWrap: 'wrap', fontSize: '0.78rem', color: '#475569' }}>
                            {[
                              { color: '#10b981', label: 'Traveling' },
                              { color: '#f59e0b', label: 'Resting' },
                              { color: '#3b82f6', label: 'Delivering' },
                              { color: '#0284c7', label: '── Route' },
                            ].map(l => (
                              <span key={l.label} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <span style={{ display: 'inline-block', width: 12, height: 12, borderRadius: '50%', background: l.color }} />
                                {l.label}
                              </span>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  )}

                  {/* ── TIMELINE TAB ── */}
                  {activeTab === 'timeline' && (
                    <div>
                      {pingsLoading ? (
                        <div style={{ textAlign: 'center', color: '#94a3b8', padding: '3rem', fontSize: '0.85rem' }}>Loading timeline…</div>
                      ) : pings.length === 0 ? (
                        <div style={{ textAlign: 'center', color: '#94a3b8', padding: '3rem', fontSize: '0.85rem' }}>No location pings recorded.</div>
                      ) : (
                        <div style={{ position: 'relative' }}>
                          {/* Vertical line */}
                          <div style={{ position: 'absolute', left: '19px', top: '10px', bottom: '10px', width: '2px', background: '#e2e8f0', zIndex: 0 }} />

                          {(() => {
                            const isOngoingShift = !selectedShift.endTime;
                            
                            // Group consecutive pings by movementType
                            const grouped: Array<{
                              type: string;
                              startTime: any;
                              endTime: any;
                              startLat: number;
                              startLng: number;
                              endLat: number;
                              endLng: number;
                              pingCount: number;
                              avgSpeedKmh: number;
                              pings: any[];
                            }> = [];

                            let cur: any = null;

                            pings.forEach((p, idx) => {
                              const isFirst = idx === 0;
                              const isLast = idx === pings.length - 1;
                              const pType = isFirst
                                ? 'start'
                                : isLast && !isOngoingShift
                                ? 'end'
                                : isLast && isOngoingShift
                                ? 'live'
                                : p.movementType;

                              const speedKmh = (p.speed || 0) * 3.6;

                              if (!cur) {
                                cur = {
                                  type: pType,
                                  startTime: p.timestamp,
                                  endTime: p.timestamp,
                                  startLat: p.lat,
                                  startLng: p.lng,
                                  endLat: p.lat,
                                  endLng: p.lng,
                                  pingCount: 1,
                                  avgSpeedKmh: speedKmh,
                                  pings: [p]
                                };
                                return;
                              }

                              const isSameType = cur.type === pType;
                              if (isSameType && pType !== 'start' && pType !== 'end') {
                                cur.endTime = p.timestamp;
                                cur.endLat = p.lat;
                                cur.endLng = p.lng;
                                cur.pingCount += 1;
                                cur.avgSpeedKmh = (cur.avgSpeedKmh * (cur.pingCount - 1) + speedKmh) / cur.pingCount;
                                cur.pings.push(p);
                              } else {
                                grouped.push(cur);
                                cur = {
                                  type: pType,
                                  startTime: p.timestamp,
                                  endTime: p.timestamp,
                                  startLat: p.lat,
                                  startLng: p.lng,
                                  endLat: p.lat,
                                  endLng: p.lng,
                                  pingCount: 1,
                                  avgSpeedKmh: speedKmh,
                                  pings: [p]
                                };
                              }
                            });
                            if (cur) grouped.push(cur);

                            // Pass 2: Merge brief indoor GPS jitter spikes (<3 pings traveling at same location) into stationary dwell block
                            const smoothed: typeof grouped = [];
                            grouped.forEach((g) => {
                              if (!smoothed.length) {
                                smoothed.push(g);
                                return;
                              }
                              const prev = smoothed[smoothed.length - 1];

                              const isJitter =
                                g.type === 'traveling' &&
                                g.pingCount <= 3 &&
                                (prev.type === 'delivering' || prev.type === 'resting' || prev.type === 'live') &&
                                Math.abs(g.endLat - prev.endLat) < 0.001 &&
                                Math.abs(g.endLng - prev.endLng) < 0.001;

                              const isBothStationary =
                                (g.type === 'delivering' || g.type === 'resting') &&
                                (prev.type === 'delivering' || prev.type === 'resting') &&
                                Math.abs(g.endLat - prev.endLat) < 0.001 &&
                                Math.abs(g.endLng - prev.endLng) < 0.001;

                              if (isJitter || isBothStationary) {
                                prev.endTime = g.endTime;
                                prev.endLat = g.endLat;
                                prev.endLng = g.endLng;
                                prev.pingCount += g.pingCount;
                                prev.pings.push(...g.pings);
                              } else {
                                smoothed.push(g);
                              }
                            });

                            return smoothed.map((g, i) => {
                              const colorMap: Record<string, string> = {
                                start: '#10b981',
                                end: '#ef4444',
                                live: '#0284c7',
                                traveling: '#10b981',
                                delivering: '#0284c7',
                                resting: '#f59e0b'
                              };

                              const labelMap: Record<string, string> = {
                                start: 'Shift Start',
                                end: 'Shift End',
                                live: 'Current Position (Live)',
                                traveling: 'Traveling',
                                delivering: 'Delivering / Customer Stop',
                                resting: 'Resting / Idle'
                              };

                              const dotColor = colorMap[g.type] || '#64748b';
                              const label = labelMap[g.type] || g.type;

                              const startTimeStr = fmtDate(g.startTime);
                              const endTimeStr = fmtDate(g.endTime);
                              const isSinglePoint = startTimeStr === endTimeStr || g.pingCount === 1;
                              const timeSpanStr = isSinglePoint ? startTimeStr : `${startTimeStr} — ${endTimeStr}`;

                              return (
                                <div key={i} style={{ display: 'flex', gap: '1rem', marginBottom: '0.75rem', alignItems: 'flex-start', position: 'relative', zIndex: 1 }}>
                                  <div style={{
                                    width: '22px', height: '22px', borderRadius: '50%',
                                    background: dotColor,
                                    border: '3px solid #fff',
                                    boxShadow: `0 0 0 2px ${dotColor}`,
                                    flexShrink: 0, marginTop: '2px'
                                  }} />

                                  <div style={{
                                    flex: 1, background: '#f8fafc',
                                    border: '1.5px solid #e2e8f0', borderRadius: '12px',
                                    padding: '0.65rem 0.95rem',
                                    fontSize: '0.8rem'
                                  }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <span style={{ fontWeight: '800', color: dotColor }}>
                                          {label}
                                        </span>
                                        {g.pingCount > 1 && (
                                          <span style={{
                                            fontSize: '0.68rem', background: 'rgba(2, 132, 199, 0.08)',
                                            color: '#0284c7', fontWeight: '700', padding: '1px 7px', borderRadius: '99px'
                                          }}>
                                            {g.pingCount} pings aggregated
                                          </span>
                                        )}
                                      </div>
                                      <span style={{ color: '#94a3b8', fontFamily: 'monospace', fontSize: '0.72rem', fontWeight: '600' }}>
                                        {timeSpanStr}
                                      </span>
                                    </div>

                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.2rem', color: '#475569', fontSize: '0.76rem', marginTop: '2px' }}>
                                      <span>Location: <strong style={{ color: '#0f172a' }}>{g.endLat.toFixed(5)}, {g.endLng.toFixed(5)}</strong></span>
                                      {g.avgSpeedKmh > 0.1 && (
                                        <span>Avg Speed: <strong style={{ color: '#0f172a' }}>{g.avgSpeedKmh.toFixed(1)} km/h</strong></span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              );
                            });
                          })()}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default RiderDetailModal;
