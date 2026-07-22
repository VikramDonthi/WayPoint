import React, { useState } from 'react';
import type { Rider } from '../types';
import { Search, Phone, MapPin, Clock, UserCheck, Trash2, Navigation } from 'lucide-react';

interface RiderListProps {
  riders: Rider[];
  onSelectRider: (rider: Rider) => void;
  onOpenAddRider: () => void;
  onDeleteRider?: (rider: Rider) => void;
}

export const RiderList: React.FC<RiderListProps> = ({
  riders,
  onSelectRider,
  onOpenAddRider,
  onDeleteRider
}) => {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'traveling' | 'delivering' | 'resting' | 'offline'>('all');
  const [deletingRider, setDeletingRider] = useState<Rider | null>(null);

  const filteredRiders = riders.filter(r => {
    const matchesSearch = r.name.toLowerCase().includes(search.toLowerCase()) || 
                          r.phone.includes(search);
    const matchesStatus = statusFilter === 'all' || r.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: Rider['status']) => {
    switch (status) {
      case 'traveling':
        return (
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            backgroundColor: 'rgba(16, 185, 129, 0.12)',
            color: '#059669',
            border: '1px solid rgba(16, 185, 129, 0.25)',
            padding: '4px 10px',
            borderRadius: '20px',
            fontSize: '0.75rem',
            fontWeight: '700'
          }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#10b981' }} className="animate-pulse-glow" />
            Traveling
          </span>
        );
      case 'delivering':
        return (
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            backgroundColor: 'rgba(2, 132, 199, 0.12)',
            color: '#0284c7',
            border: '1px solid rgba(2, 132, 199, 0.25)',
            padding: '4px 10px',
            borderRadius: '20px',
            fontSize: '0.75rem',
            fontWeight: '700'
          }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#0284c7' }} className="animate-pulse-glow" />
            At Delivery Stop
          </span>
        );
      case 'resting':
        return (
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            backgroundColor: 'rgba(245, 158, 11, 0.12)',
            color: '#d97706',
            border: '1px solid rgba(245, 158, 11, 0.25)',
            padding: '4px 10px',
            borderRadius: '20px',
            fontSize: '0.75rem',
            fontWeight: '700'
          }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#f59e0b' }} />
            Resting
          </span>
        );
      case 'offline':
      default:
        return (
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            backgroundColor: '#f1f5f9',
            color: '#64748b',
            border: '1px solid #e2e8f0',
            padding: '4px 10px',
            borderRadius: '20px',
            fontSize: '0.75rem',
            fontWeight: '600'
          }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#94a3b8' }} />
            Offline
          </span>
        );
    }
  };

  const formatTimestamp = (timestamp: any) => {
    if (!timestamp) return 'No location reported';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const handleDeleteConfirm = (e: React.MouseEvent, rider: Rider) => {
    e.stopPropagation();
    setDeletingRider(rider);
  };

  const confirmDelete = () => {
    if (deletingRider && onDeleteRider) {
      onDeleteRider(deletingRider);
      setDeletingRider(null);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Filters & Search Header */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '1rem',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: '#ffffff',
        padding: '1rem',
        borderRadius: '16px',
        border: '1px solid #e2e8f0',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)'
      }}>
        {/* Search Input */}
        <div style={{ position: 'relative', minWidth: '280px', flex: 1 }}>
          <Search size={18} color="#94a3b8" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }} />
          <input
            type="text"
            placeholder="Search by rider name or mobile number..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: '100%',
              padding: '0.65rem 0.65rem 0.65rem 2.6rem',
              backgroundColor: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '10px',
              color: '#0f172a',
              fontSize: '0.85rem',
              outline: 'none'
            }}
          />
        </div>

        {/* Status Filter Tabs */}
        <div style={{ display: 'flex', gap: '0.35rem', backgroundColor: '#f1f5f9', padding: '4px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
          {(['all', 'traveling', 'delivering', 'resting', 'offline'] as const).map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              style={{
                padding: '0.4rem 0.85rem',
                borderRadius: '8px',
                border: 'none',
                fontSize: '0.78rem',
                fontWeight: '700',
                textTransform: 'capitalize',
                backgroundColor: statusFilter === status ? '#ffffff' : 'transparent',
                color: statusFilter === status ? '#0284c7' : '#64748b',
                boxShadow: statusFilter === status ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                transition: 'all 0.15s ease'
              }}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      {/* Rider Card Grid */}
      {filteredRiders.length === 0 ? (
        <div style={{
          backgroundColor: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '16px',
          padding: '3.5rem 1.5rem',
          textAlign: 'center',
          color: '#64748b',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)'
        }}>
          <UserCheck size={48} color="#cbd5e1" style={{ marginBottom: '1rem' }} />
          <h3 style={{ fontSize: '1.1rem', color: '#0f172a', marginBottom: '0.5rem', fontWeight: '700' }}>No Riders Found</h3>
          <p style={{ fontSize: '0.85rem', marginBottom: '1.25rem', color: '#64748b' }}>
            {riders.length === 0 
              ? "You haven't added any riders yet. Add your first rider to begin tracking." 
              : "No riders match your current search or status filter."}
          </p>
          {riders.length === 0 && (
            <button
              onClick={onOpenAddRider}
              style={{
                backgroundColor: '#0284c7',
                color: '#ffffff',
                border: 'none',
                padding: '0.65rem 1.25rem',
                borderRadius: '10px',
                fontWeight: '700',
                fontSize: '0.85rem',
                boxShadow: '0 4px 12px rgba(2, 132, 199, 0.25)'
              }}
            >
              + Add First Rider
            </button>
          )}
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
          gap: '1.25rem'
        }}>
          {filteredRiders.map((rider) => (
            <div
              key={rider.id}
              onClick={() => onSelectRider(rider)}
              style={{
                backgroundColor: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: '16px',
                padding: '1.25rem',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: '1rem',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                position: 'relative',
                boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = '#0284c7';
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 8px 20px rgba(0, 0, 0, 0.08)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = '#e2e8f0';
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.04)';
              }}
            >
              {/* Card Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <h3 style={{ fontSize: '1.05rem', fontWeight: '800', color: '#0f172a', marginBottom: '2px' }}>
                    {rider.name}
                  </h3>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#64748b', fontSize: '0.82rem' }}>
                    <Phone size={13} color="#0284c7" />
                    <span style={{ fontFamily: 'monospace', fontWeight: '600' }}>{rider.phone}</span>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  {getStatusBadge(rider.status)}
                  {onDeleteRider && (
                    <button
                      onClick={(e) => handleDeleteConfirm(e, rider)}
                      title="Delete Rider"
                      style={{
                        background: 'rgba(239, 68, 68, 0.08)',
                        border: '1px solid rgba(239, 68, 68, 0.2)',
                        color: '#ef4444',
                        padding: '5px',
                        borderRadius: '8px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
              </div>

              {/* Location, Distance & Shift Details */}
              <div style={{
                backgroundColor: '#f8fafc',
                borderRadius: '12px',
                padding: '0.85rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.55rem',
                fontSize: '0.8rem',
                border: '1px solid #e2e8f0'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#64748b', fontWeight: '600' }}>
                    <Navigation size={14} color="#2563eb" /> Shift Distance
                  </span>
                  <span style={{ fontFamily: 'monospace', fontWeight: '800', color: '#0284c7', backgroundColor: 'rgba(2, 132, 199, 0.1)', padding: '2px 8px', borderRadius: '6px' }}>
                    {Number(rider.totalDistanceKm || 0).toFixed(3)} km
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#64748b', fontWeight: '600' }}>
                    <MapPin size={14} color="#0284c7" /> Last Location
                  </span>
                  {rider.lastLocation ? (
                    <span style={{ fontFamily: 'monospace', color: '#0f172a', fontWeight: '600' }}>
                      {rider.lastLocation.lat.toFixed(4)}, {rider.lastLocation.lng.toFixed(4)}
                    </span>
                  ) : (
                    <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>None</span>
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#64748b', fontWeight: '600' }}>
                    <Clock size={14} color="#d97706" /> Last Ping
                  </span>
                  <span style={{ color: '#475569', fontWeight: '500' }}>
                    {formatTimestamp(rider.lastLocation?.timestamp)}
                  </span>
                </div>
              </div>

              {/* Action Footer */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                paddingTop: '0.5rem',
                borderTop: '1px solid #e2e8f0',
                fontSize: '0.78rem',
                color: '#0284c7',
                fontWeight: '700'
              }}>
                <span>UID: {rider.id.substring(0, 8)}...</span>
                <span>View Shift & Route →</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Confirmation Modal for Delete */}
      {deletingRider && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.6)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '1rem'
        }}>
          <div style={{
            backgroundColor: '#ffffff',
            borderRadius: '20px',
            padding: '1.75rem',
            maxWidth: '400px',
            width: '100%',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
            border: '1px solid #e2e8f0'
          }}>
            <h3 style={{ fontSize: '1.15rem', fontWeight: '800', color: '#0f172a', marginBottom: '0.5rem' }}>
              Delete Rider?
            </h3>
            <p style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '1.5rem', lineHeight: '1.4' }}>
              Are you sure you want to delete rider <strong style={{ color: '#0f172a' }}>{deletingRider.name}</strong> ({deletingRider.phone})? This action cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setDeletingRider(null)}
                style={{
                  padding: '0.6rem 1.1rem',
                  borderRadius: '10px',
                  border: '1px solid #cbd5e1',
                  backgroundColor: '#ffffff',
                  color: '#475569',
                  fontWeight: '600',
                  fontSize: '0.85rem'
                }}
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                style={{
                  padding: '0.6rem 1.1rem',
                  borderRadius: '10px',
                  border: 'none',
                  backgroundColor: '#ef4444',
                  color: '#ffffff',
                  fontWeight: '700',
                  fontSize: '0.85rem',
                  boxShadow: '0 4px 12px rgba(239, 68, 68, 0.3)'
                }}
              >
                Delete Rider
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
