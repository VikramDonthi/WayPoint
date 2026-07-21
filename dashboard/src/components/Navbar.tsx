import React from 'react';
import { Navigation, Users, UserPlus, Settings, LogOut, MapPin, Smartphone } from 'lucide-react';
import { logoutAdmin } from '../firebase';

interface NavbarProps {
  activeTab: 'map' | 'riders';
  setActiveTab: (tab: 'map' | 'riders') => void;
  onOpenAddRider: () => void;
  onOpenConfig: () => void;
  onOpenQR: () => void;
  riderCount: number;
  onlineCount: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  onOpenAddRider,
  onOpenConfig,
  onOpenQR,
  riderCount,
  onlineCount
}) => {
  return (
    <header style={{
      backgroundColor: '#ffffff',
      borderBottom: '1px solid #e2e8f0',
      padding: '0.85rem 1.5rem',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      position: 'sticky',
      top: 0,
      zIndex: 100,
      boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)'
    }}>
      {/* Brand & Stats */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{
            background: 'linear-gradient(135deg, #0284c7 0%, #2563eb 100%)',
            padding: '8px',
            borderRadius: '12px',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(37, 99, 235, 0.25)'
          }}>
            <Navigation size={22} style={{ transform: 'rotate(45deg)' }} />
          </div>
          <div>
            <h1 style={{ fontSize: '1.25rem', fontWeight: '800', letterSpacing: '-0.02em', color: '#0f172a', lineHeight: 1.1 }}>
              WAYPOINT
            </h1>
            <p style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: '600' }}>Fleet Tracking Command</p>
          </div>
        </div>

        {/* Live Counters */}
        <div style={{
          display: 'flex',
          gap: '0.75rem',
          backgroundColor: '#f1f5f9',
          padding: '0.4rem 0.9rem',
          borderRadius: '20px',
          border: '1px solid #e2e8f0',
          fontSize: '0.8rem',
          fontWeight: '500'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#10b981', display: 'inline-block' }} />
            <span style={{ color: '#475569' }}>Online: <strong style={{ color: '#059669', fontWeight: '700' }}>{onlineCount}</strong></span>
          </div>
          <span style={{ color: '#cbd5e1' }}>|</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span style={{ color: '#475569' }}>Total Riders: <strong style={{ color: '#0f172a', fontWeight: '700' }}>{riderCount}</strong></span>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div style={{ display: 'flex', gap: '0.35rem', backgroundColor: '#f1f5f9', padding: '4px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
        <button
          onClick={() => setActiveTab('map')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.5rem 1.1rem',
            borderRadius: '9px',
            border: 'none',
            fontSize: '0.85rem',
            fontWeight: '700',
            backgroundColor: activeTab === 'map' ? '#ffffff' : 'transparent',
            color: activeTab === 'map' ? '#0284c7' : '#64748b',
            boxShadow: activeTab === 'map' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
            transition: 'all 0.2s ease'
          }}
        >
          <MapPin size={16} />
          Live Map
        </button>

        <button
          onClick={() => setActiveTab('riders')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.5rem 1.1rem',
            borderRadius: '9px',
            border: 'none',
            fontSize: '0.85rem',
            fontWeight: '700',
            backgroundColor: activeTab === 'riders' ? '#ffffff' : 'transparent',
            color: activeTab === 'riders' ? '#0284c7' : '#64748b',
            boxShadow: activeTab === 'riders' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
            transition: 'all 0.2s ease'
          }}
        >
          <Users size={16} />
          Riders ({riderCount})
        </button>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <button
          onClick={onOpenQR}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.55rem 0.95rem',
            borderRadius: '10px',
            backgroundColor: 'rgba(2, 132, 199, 0.08)',
            border: '1px solid rgba(2, 132, 199, 0.2)',
            color: '#0284c7',
            fontWeight: '700',
            fontSize: '0.85rem',
            transition: 'all 0.15s ease'
          }}
        >
          <Smartphone size={16} />
          Rider QR App
        </button>

        <button
          onClick={onOpenAddRider}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.55rem 1.1rem',
            borderRadius: '10px',
            backgroundColor: '#0284c7',
            color: '#ffffff',
            fontWeight: '700',
            border: 'none',
            fontSize: '0.85rem',
            boxShadow: '0 4px 12px rgba(2, 132, 199, 0.3)',
            transition: 'all 0.15s ease'
          }}
        >
          <UserPlus size={16} />
          Add Rider
        </button>

        <button
          onClick={onOpenConfig}
          title="Firebase Configuration"
          style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            color: '#64748b',
            padding: '8px',
            borderRadius: '10px',
            cursor: 'pointer',
            display: 'flex',
            boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
          }}
        >
          <Settings size={18} />
        </button>

        <button
          onClick={logoutAdmin}
          title="Sign Out"
          style={{
            background: 'rgba(239, 68, 68, 0.08)',
            border: '1px solid rgba(239, 68, 68, 0.2)',
            color: '#ef4444',
            padding: '8px',
            borderRadius: '10px',
            cursor: 'pointer',
            display: 'flex'
          }}
        >
          <LogOut size={18} />
        </button>
      </div>
    </header>
  );
};
