import React, { useState, useRef, useEffect } from 'react';
import { Navigation, Users, UserPlus, Settings, LogOut, MapPin, ChevronDown, Shield, Phone, Mail, Activity } from 'lucide-react';
import { logoutAdmin } from '../firebase';
import type { User } from 'firebase/auth';

interface NavbarProps {
  activeTab: 'map' | 'riders';
  setActiveTab: (tab: 'map' | 'riders') => void;
  onOpenAddRider: () => void;
  onOpenConfig: () => void;
  riderCount: number;
  onlineCount: number;
  currentUser?: User | null;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  onOpenAddRider,
  onOpenConfig,
  riderCount,
  onlineCount,
  currentUser,
}) => {
  const [profileOpen, setProfileOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const displayName = currentUser?.displayName || currentUser?.email?.split('@')[0] || 'Admin';
  const displayEmail = currentUser?.email || 'admin@waypoint.app';
  const isAnon = currentUser?.isAnonymous;
  const initials = displayName.substring(0, 2).toUpperCase();

  return (
    <header style={{
      backgroundColor: '#ffffff',
      borderBottom: '1px solid #e2e8f0',
      padding: '0 1.75rem',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      position: 'sticky',
      top: 0,
      zIndex: 200,
      height: '64px',
      boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
    }}>

      {/* ── Brand ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{
            background: 'linear-gradient(135deg,#0284c7,#2563eb)',
            padding: '9px',
            borderRadius: '12px',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(37,99,235,0.3)',
          }}>
            <Navigation size={20} style={{ transform: 'rotate(45deg)' }} />
          </div>
          <div>
            <h1 style={{ fontSize: '1.2rem', fontWeight: '900', letterSpacing: '-0.03em', color: '#0f172a', lineHeight: 1.1, margin: 0 }}>
              VALMO FLEET
            </h1>
            <p style={{ fontSize: '0.68rem', color: '#94a3b8', fontWeight: '600', margin: 0, letterSpacing: '0.04em' }}>FLEET COMMAND</p>
          </div>
        </div>

        {/* Live stats pill */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '1px',
          backgroundColor: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderRadius: '12px',
          overflow: 'hidden',
          fontSize: '0.78rem',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.4rem 0.85rem', borderRight: '1px solid #e2e8f0' }}>
            <span style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: '#10b981', display: 'inline-block', animation: 'pulse 2s infinite' }} />
            <span style={{ color: '#475569', fontWeight: '600' }}>Online</span>
            <strong style={{ color: '#059669' }}>{onlineCount}</strong>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.4rem 0.85rem' }}>
            <Activity size={13} color="#64748b" />
            <span style={{ color: '#475569', fontWeight: '600' }}>Total</span>
            <strong style={{ color: '#0f172a' }}>{riderCount}</strong>
          </div>
        </div>
      </div>

      {/* ── Nav Tabs ── */}
      <div style={{ display: 'flex', gap: '2px', backgroundColor: '#f1f5f9', padding: '4px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
        {[
          { id: 'map' as const, label: 'Live Map', icon: <MapPin size={15} /> },
          { id: 'riders' as const, label: `Riders (${riderCount})`, icon: <Users size={15} /> },
        ].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
            display: 'flex', alignItems: 'center', gap: '0.45rem',
            padding: '0.5rem 1.1rem', borderRadius: '9px', border: 'none',
            fontSize: '0.83rem', fontWeight: '700', cursor: 'pointer',
            backgroundColor: activeTab === tab.id ? '#ffffff' : 'transparent',
            color: activeTab === tab.id ? '#0284c7' : '#64748b',
            boxShadow: activeTab === tab.id ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
            transition: 'all 0.18s ease',
          }}>
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* ── Actions + Profile ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>

        <button onClick={onOpenAddRider} style={{
          display: 'flex', alignItems: 'center', gap: '0.4rem',
          padding: '0.5rem 1rem', borderRadius: '10px',
          background: 'linear-gradient(135deg,#0284c7,#2563eb)', color: '#fff',
          fontWeight: '700', border: 'none', fontSize: '0.82rem', cursor: 'pointer',
          boxShadow: '0 4px 12px rgba(2,132,199,0.3)',
        }}>
          <UserPlus size={15} /> Add Rider
        </button>

        <button onClick={onOpenConfig} title="Settings" style={{
          background: '#f8fafc', border: '1px solid #e2e8f0', color: '#64748b',
          padding: '8px', borderRadius: '10px', cursor: 'pointer', display: 'flex',
        }}>
          <Settings size={17} />
        </button>

        {/* ── Profile Dropdown ── */}
        <div ref={dropdownRef} style={{ position: 'relative' }}>
          <button
            onClick={() => setProfileOpen(v => !v)}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.55rem',
              padding: '5px 10px 5px 5px',
              background: profileOpen ? '#f1f5f9' : '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '99px', cursor: 'pointer',
              transition: 'all 0.15s',
            }}
          >
            <div style={{
              width: '32px', height: '32px', borderRadius: '50%',
              background: 'linear-gradient(135deg,#0284c7,#7c3aed)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff', fontWeight: '800', fontSize: '0.78rem',
            }}>
              {isAnon ? 'A' : initials}
            </div>
            <div style={{ textAlign: 'left', lineHeight: 1.2 }}>
              <div style={{ fontSize: '0.8rem', fontWeight: '700', color: '#0f172a' }}>
                {isAnon ? 'Dev Mode' : displayName}
              </div>
              <div style={{ fontSize: '0.68rem', color: '#94a3b8' }}>Admin</div>
            </div>
            <ChevronDown size={14} color="#94a3b8" style={{ transform: profileOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
          </button>

          {profileOpen && (
            <div style={{
              position: 'absolute', top: 'calc(100% + 8px)', right: 0,
              width: '280px',
              backgroundColor: '#fff',
              border: '1px solid #e2e8f0',
              borderRadius: '18px',
              boxShadow: '0 16px 40px rgba(0,0,0,0.12)',
              overflow: 'hidden',
              zIndex: 300,
              animation: 'fadeSlideDown 0.15s ease',
            }}>
              {/* Profile header */}
              <div style={{
                background: 'linear-gradient(135deg,#0f172a,#1e3a5f)',
                padding: '1.25rem',
                display: 'flex', alignItems: 'center', gap: '1rem',
              }}>
                <div style={{
                  width: '52px', height: '52px', borderRadius: '16px',
                  background: 'linear-gradient(135deg,#0284c7,#7c3aed)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#fff', fontWeight: '900', fontSize: '1.15rem',
                  border: '2px solid rgba(255,255,255,0.2)',
                  flexShrink: 0,
                }}>
                  {isAnon ? 'A' : initials}
                </div>
                <div>
                  <div style={{ color: '#fff', fontWeight: '800', fontSize: '0.95rem' }}>
                    {isAnon ? 'Dev Mode User' : displayName}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px' }}>
                    <Shield size={11} color="#10b981" />
                    <span style={{ fontSize: '0.72rem', color: '#10b981', fontWeight: '700' }}>Administrator</span>
                  </div>
                </div>
              </div>

              {/* Info rows */}
              <div style={{ padding: '0.75rem 1rem' }}>
                {[
                  { icon: <Mail size={14} color="#0284c7" />, label: 'Email', value: displayEmail },
                  { icon: <Phone size={14} color="#0284c7" />, label: 'Phone', value: isAnon ? 'Not set' : currentUser?.phoneNumber || 'Not set' },
                  { icon: <Shield size={14} color="#10b981" />, label: 'Role', value: 'Fleet Administrator' },
                ].map(row => (
                  <div key={row.label} style={{
                    display: 'flex', alignItems: 'center', gap: '0.75rem',
                    padding: '0.55rem 0.5rem',
                    borderBottom: '1px solid #f1f5f9',
                  }}>
                    {row.icon}
                    <div>
                      <div style={{ fontSize: '0.68rem', color: '#94a3b8', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{row.label}</div>
                      <div style={{ fontSize: '0.82rem', color: '#0f172a', fontWeight: '600' }}>{row.value}</div>
                    </div>
                  </div>
                ))}

                {/* Fleet stats */}
                <div style={{
                  display: 'grid', gridTemplateColumns: '1fr 1fr',
                  gap: '0.5rem', marginTop: '0.75rem', marginBottom: '0.5rem',
                }}>
                  {[
                    { label: 'Total Riders', value: riderCount, color: '#0284c7' },
                    { label: 'Online Now', value: onlineCount, color: '#10b981' },
                  ].map(stat => (
                    <div key={stat.label} style={{
                      background: '#f8fafc', borderRadius: '10px',
                      border: '1px solid #e2e8f0', padding: '0.65rem 0.75rem', textAlign: 'center',
                    }}>
                      <div style={{ fontSize: '1.4rem', fontWeight: '900', color: stat.color }}>{stat.value}</div>
                      <div style={{ fontSize: '0.68rem', color: '#94a3b8', fontWeight: '600' }}>{stat.label}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Sign out */}
              <div style={{ padding: '0.5rem 0.75rem 0.75rem' }}>
                <button
                  onClick={() => { logoutAdmin(); setProfileOpen(false); }}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                    padding: '0.65rem', borderRadius: '12px',
                    background: 'rgba(239,68,68,0.08)', border: '1.5px solid rgba(239,68,68,0.2)',
                    color: '#ef4444', fontWeight: '700', fontSize: '0.85rem', cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}
                  onMouseOver={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.14)'; }}
                  onMouseOut={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.08)'; }}
                >
                  <LogOut size={16} /> Sign Out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
