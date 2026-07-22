import React, { useState } from 'react';
import { Phone, Navigation, Activity, Clock, TrendingUp, ChevronRight, Bike } from 'lucide-react';
import type { Rider } from '../types';

interface FleetSidebarProps {
  riders: Rider[];
  onSelectRider: (rider: Rider) => void;
}

const STATUS_CONFIG = {
  traveling: { color: '#10b981', bg: '#dcfce7', label: 'Traveling', dot: '#10b981' },
  delivering: { color: '#3b82f6', bg: '#dbeafe', label: 'Delivering', dot: '#3b82f6' },
  resting: { color: '#f59e0b', bg: '#fef9c3', label: 'Resting', dot: '#f59e0b' },
  offline: { color: '#94a3b8', bg: '#f1f5f9', label: 'Offline', dot: '#94a3b8' },
};

function timeAgo(ts: any): string {
  if (!ts) return 'Unknown';
  const date = ts?.toDate ? ts.toDate() : new Date(ts);
  const diffMs = Date.now() - date.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
}

export const FleetSidebar: React.FC<FleetSidebarProps> = ({ riders, onSelectRider }) => {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'online' | 'offline'>('all');

  const online = riders.filter(r => r.status !== 'offline');
  const offline = riders.filter(r => r.status === 'offline');

  const totalKm = riders.reduce((sum, r) => sum + (r.totalDistanceKm || 0), 0);

  const filtered = riders.filter(r => {
    const matchesSearch = r.name.toLowerCase().includes(search.toLowerCase()) || r.phone.includes(search);
    if (filter === 'online') return matchesSearch && r.status !== 'offline';
    if (filter === 'offline') return matchesSearch && r.status === 'offline';
    return matchesSearch;
  });

  return (
    <div style={{
      width: '300px',
      flexShrink: 0,
      display: 'flex',
      flexDirection: 'column',
      backgroundColor: '#ffffff',
      border: '1px solid #e2e8f0',
      borderRadius: '16px',
      overflow: 'hidden',
      boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
      height: 'calc(100vh - 96px)',
    }}>

      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg,#0f172a,#1e3a5f)',
        padding: '1rem 1.25rem',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
          <h3 style={{ color: '#fff', fontWeight: '800', fontSize: '0.9rem', margin: 0 }}>Fleet Overview</h3>
          <span style={{
            background: online.length > 0 ? 'rgba(16,185,129,0.2)' : 'rgba(148,163,184,0.2)',
            color: online.length > 0 ? '#10b981' : '#94a3b8',
            fontSize: '0.7rem', fontWeight: '700',
            padding: '2px 8px', borderRadius: '99px',
            border: `1px solid ${online.length > 0 ? 'rgba(16,185,129,0.3)' : 'rgba(148,163,184,0.3)'}`,
          }}>
            {online.length > 0 ? `${online.length} LIVE` : 'ALL OFFLINE'}
          </span>
        </div>

        {/* Mini stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem' }}>
          {[
            { label: 'Online', value: online.length, icon: <Activity size={13} />, color: '#10b981' },
            { label: 'Offline', value: offline.length, icon: <Clock size={13} />, color: '#94a3b8' },
            { label: 'Km Today', value: totalKm.toFixed(0), icon: <Navigation size={13} />, color: '#38bdf8' },
          ].map(s => (
            <div key={s.label} style={{
              background: 'rgba(255,255,255,0.07)',
              borderRadius: '10px', padding: '0.5rem 0.4rem',
              textAlign: 'center',
              border: '1px solid rgba(255,255,255,0.08)',
            }}>
              <div style={{ color: s.color, marginBottom: '2px' }}>{s.icon}</div>
              <div style={{ color: '#fff', fontWeight: '900', fontSize: '1rem', lineHeight: 1 }}>{s.value}</div>
              <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.62rem', fontWeight: '600', marginTop: '2px' }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Search + filter */}
      <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #f1f5f9' }}>
        <input
          type="text"
          placeholder="Search riders..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            width: '100%', padding: '0.5rem 0.75rem',
            borderRadius: '8px', border: '1px solid #e2e8f0',
            fontSize: '0.8rem', outline: 'none',
            background: '#f8fafc', color: '#0f172a',
            boxSizing: 'border-box',
          }}
        />
        <div style={{ display: 'flex', gap: '0.35rem', marginTop: '0.5rem' }}>
          {(['all', 'online', 'offline'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)} style={{
              flex: 1, padding: '0.3rem 0', borderRadius: '7px',
              border: 'none', fontSize: '0.72rem', fontWeight: '700',
              textTransform: 'capitalize', cursor: 'pointer',
              background: filter === f ? '#0284c7' : '#f1f5f9',
              color: filter === f ? '#fff' : '#64748b',
              transition: 'all 0.15s',
            }}>
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Rider list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0.5rem' }}>
        {filtered.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#94a3b8', fontSize: '0.82rem', padding: '2rem 1rem' }}>
            <Bike size={32} color="#e2e8f0" style={{ marginBottom: '0.5rem' }} />
            <p>No riders found</p>
          </div>
        ) : (
          filtered.map(rider => {
            const sc = STATUS_CONFIG[rider.status] || STATUS_CONFIG.offline;
            return (
              <div
                key={rider.id}
                onClick={() => onSelectRider(rider)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.75rem',
                  padding: '0.7rem 0.75rem',
                  borderRadius: '12px', cursor: 'pointer',
                  marginBottom: '2px',
                  transition: 'background 0.15s',
                  border: '1px solid transparent',
                }}
                onMouseOver={e => {
                  e.currentTarget.style.background = '#f8fafc';
                  e.currentTarget.style.borderColor = '#e2e8f0';
                }}
                onMouseOut={e => {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.borderColor = 'transparent';
                }}
              >
                {/* Avatar with status dot */}
                <div style={{ position: 'relative', flexShrink: 0 }}>
                  <div style={{
                    width: '38px', height: '38px', borderRadius: '12px',
                    background: 'linear-gradient(135deg,#0284c7,#2563eb)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#fff', fontWeight: '800', fontSize: '0.9rem',
                  }}>
                    {rider.name.charAt(0).toUpperCase()}
                  </div>
                  <span style={{
                    position: 'absolute', bottom: '-2px', right: '-2px',
                    width: '11px', height: '11px', borderRadius: '50%',
                    background: sc.dot,
                    border: '2px solid #fff',
                  }} />
                </div>

                {/* Name + info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: '700', fontSize: '0.85rem', color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {rider.name}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.72rem', color: '#94a3b8', marginTop: '1px' }}>
                    <Phone size={10} />
                    <span style={{ fontFamily: 'monospace' }}>{rider.phone}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '3px' }}>
                    <span style={{
                      fontSize: '0.67rem', fontWeight: '700',
                      color: sc.color, background: sc.bg,
                      padding: '1px 6px', borderRadius: '99px',
                    }}>{sc.label}</span>
                    {rider.lastLocation && (
                      <span style={{ fontSize: '0.67rem', color: '#94a3b8' }}>
                        · {timeAgo(rider.lastLocation.timestamp)}
                      </span>
                    )}
                  </div>
                </div>

                {/* Distance + arrow */}
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontSize: '0.82rem', fontWeight: '800', color: '#0284c7' }}>
                    {Number(rider.totalDistanceKm || 0).toFixed(3)} km
                  </div>
                  <ChevronRight size={13} color="#cbd5e1" />
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer */}
      <div style={{
        padding: '0.75rem 1rem',
        borderTop: '1px solid #f1f5f9',
        background: '#f8fafc',
        display: 'flex', alignItems: 'center', gap: '0.4rem',
        fontSize: '0.72rem', color: '#94a3b8',
      }}>
        <TrendingUp size={12} />
        <span>Fleet total: <strong style={{ color: '#0284c7' }}>{totalKm.toFixed(1)} km</strong> across {riders.length} riders</span>
      </div>
    </div>
  );
};
