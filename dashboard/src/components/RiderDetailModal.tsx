import React, { useEffect, useState } from 'react';
import { X, Clock, Navigation, PackageCheck, MapPin } from 'lucide-react';
import type { Rider, Shift, PingPoint } from '../types';
import { db } from '../firebase';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';

interface RiderDetailModalProps {
  rider: Rider | null;
  onClose: () => void;
}

export const RiderDetailModal: React.FC<RiderDetailModalProps> = ({ rider, onClose }) => {
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [selectedShiftId, setSelectedShiftId] = useState<string | null>(null);
  const [pings, setPings] = useState<PingPoint[]>([]);
  const [loading, setLoading] = useState(false);

  // Derived shift stats computed client-side
  const [stats, setStats] = useState({
    travelingMinutes: 0,
    deliveringMinutes: 0,
    restingMinutes: 0,
    totalPings: 0,
    totalDistanceKm: 0
  });

  useEffect(() => {
    if (!rider || !db) return;

    const fetchShifts = async () => {
      setLoading(true);
      try {
        const shiftsRef = collection(db!, 'shifts');
        const q = query(
          shiftsRef, 
          where('riderId', '==', rider.id),
          limit(10)
        );
        const snapshot = await getDocs(q);
        const shiftList: Shift[] = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data()
        })) as Shift[];

        setShifts(shiftList);
        if (shiftList.length > 0) {
          setSelectedShiftId(shiftList[0].id);
        }
      } catch (err) {
        console.error('Failed to fetch rider shifts', err);
      } finally {
        setLoading(false);
      }
    };

    fetchShifts();
  }, [rider]);

  useEffect(() => {
    if (!selectedShiftId || !db) {
      setPings([]);
      setStats({ travelingMinutes: 0, deliveringMinutes: 0, restingMinutes: 0, totalPings: 0, totalDistanceKm: 0 });
      return;
    }

    const selectedShift = shifts.find(s => s.id === selectedShiftId);

    const fetchPings = async () => {
      try {
        const pingsRef = collection(db!, 'pings', selectedShiftId, 'points');
        const q = query(pingsRef, orderBy('timestamp', 'asc'));
        const snapshot = await getDocs(q);
        const pingList: PingPoint[] = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data()
        })) as PingPoint[];

        setPings(pingList);

        // Compute client-side shift stats by summing time deltas and distance
        let travelSec = 0;
        let deliverSec = 0;
        let restSec = 0;

        for (let i = 1; i < pingList.length; i++) {
          const prev = pingList[i - 1];
          const curr = pingList[i];
          const tPrev = prev.timestamp?.toDate ? prev.timestamp.toDate().getTime() : new Date(prev.timestamp).getTime();
          const tCurr = curr.timestamp?.toDate ? curr.timestamp.toDate().getTime() : new Date(curr.timestamp).getTime();
          const deltaSec = Math.max(0, (tCurr - tPrev) / 1000);

          if (curr.movementType === 'traveling') {
            travelSec += deltaSec;
          } else if (curr.movementType === 'delivering') {
            deliverSec += deltaSec;
          } else {
            restSec += deltaSec;
          }
        }

        setStats({
          travelingMinutes: Math.round(travelSec / 60),
          deliveringMinutes: Math.round(deliverSec / 60),
          restingMinutes: Math.round(restSec / 60),
          totalPings: pingList.length,
          totalDistanceKm: selectedShift?.totalDistanceKm || rider?.totalDistanceKm || 0
        });
      } catch (err) {
        console.error('Failed to fetch shift pings', err);
      }
    };

    fetchPings();
  }, [selectedShiftId, shifts, rider]);

  if (!rider) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(15, 23, 42, 0.6)',
      backdropFilter: 'blur(6px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '1rem'
    }}>
      <div style={{
        backgroundColor: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '20px',
        width: '100%',
        maxWidth: '720px',
        maxHeight: '90vh',
        overflowY: 'auto',
        padding: '1.75rem',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
        position: 'relative'
      }}>
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '1.25rem',
            right: '1.25rem',
            background: '#f1f5f9',
            border: 'none',
            color: '#64748b',
            borderRadius: '50%',
            padding: '6px',
            display: 'flex',
            cursor: 'pointer'
          }}
        >
          <X size={18} />
        </button>

        {/* Rider Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
          <div style={{
            width: '52px',
            height: '52px',
            borderRadius: '16px',
            backgroundColor: '#0284c7',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.35rem',
            fontWeight: '800',
            color: '#ffffff',
            boxShadow: '0 4px 12px rgba(2, 132, 199, 0.3)'
          }}>
            {rider.name.substring(0, 1).toUpperCase()}
          </div>
          <div>
            <h2 style={{ fontSize: '1.3rem', fontWeight: '800', color: '#0f172a' }}>{rider.name}</h2>
            <div style={{ display: 'flex', gap: '1rem', fontSize: '0.82rem', color: '#64748b', marginTop: '2px' }}>
              <span>📱 {rider.phone}</span>
              <span>•</span>
              <span style={{ fontFamily: 'monospace' }}>UID: {rider.id}</span>
            </div>
          </div>
        </div>

        {/* Shift Selection */}
        <div style={{ marginBottom: '1.25rem' }}>
          <label style={{ display: 'block', fontSize: '0.82rem', color: '#64748b', fontWeight: '700', marginBottom: '0.5rem' }}>
            Select Shift History
          </label>
          {shifts.length === 0 ? (
            <div style={{ fontSize: '0.85rem', color: '#64748b', backgroundColor: '#f8fafc', padding: '0.75rem', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
              {loading ? 'Loading shift history...' : 'No shifts recorded for this rider yet.'}
            </div>
          ) : (
            <div style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', paddingBottom: '4px' }}>
              {shifts.map((shift) => (
                <button
                  key={shift.id}
                  onClick={() => setSelectedShiftId(shift.id)}
                  style={{
                    padding: '0.5rem 0.85rem',
                    borderRadius: '9px',
                    border: '1px solid',
                    borderColor: selectedShiftId === shift.id ? '#0284c7' : '#e2e8f0',
                    backgroundColor: selectedShiftId === shift.id ? 'rgba(2, 132, 199, 0.1)' : '#f8fafc',
                    color: selectedShiftId === shift.id ? '#0284c7' : '#475569',
                    fontSize: '0.8rem',
                    fontWeight: '700',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap'
                  }}
                >
                  Shift #{shift.id.substring(0, 6)}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Client-Side Computed Stats Cards */}
        {selectedShiftId && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
            gap: '0.75rem',
            marginBottom: '1.5rem'
          }}>
            <div style={{ backgroundColor: '#f8fafc', padding: '0.85rem', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#0284c7', fontSize: '0.75rem', fontWeight: '700', marginBottom: '4px' }}>
                <Navigation size={14} /> Distance
              </div>
              <div style={{ fontSize: '1.25rem', fontWeight: '800', color: '#0f172a' }}>
                {stats.totalDistanceKm.toFixed(2)} <span style={{ fontSize: '0.75rem', fontWeight: 'normal', color: '#64748b' }}>km</span>
              </div>
            </div>

            <div style={{ backgroundColor: '#f8fafc', padding: '0.85rem', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#059669', fontSize: '0.75rem', fontWeight: '700', marginBottom: '4px' }}>
                <MapPin size={14} /> Traveling Time
              </div>
              <div style={{ fontSize: '1.25rem', fontWeight: '800', color: '#0f172a' }}>
                {stats.travelingMinutes} <span style={{ fontSize: '0.75rem', fontWeight: 'normal', color: '#64748b' }}>mins</span>
              </div>
            </div>

            <div style={{ backgroundColor: '#f8fafc', padding: '0.85rem', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#0284c7', fontSize: '0.75rem', fontWeight: '700', marginBottom: '4px' }}>
                <PackageCheck size={14} /> Delivery Stops
              </div>
              <div style={{ fontSize: '1.25rem', fontWeight: '800', color: '#0f172a' }}>
                {stats.deliveringMinutes} <span style={{ fontSize: '0.75rem', fontWeight: 'normal', color: '#64748b' }}>mins</span>
              </div>
            </div>

            <div style={{ backgroundColor: '#f8fafc', padding: '0.85rem', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#d97706', fontSize: '0.75rem', fontWeight: '700', marginBottom: '4px' }}>
                <Clock size={14} /> Resting Time
              </div>
              <div style={{ fontSize: '1.25rem', fontWeight: '800', color: '#0f172a' }}>
                {stats.restingMinutes} <span style={{ fontSize: '0.75rem', fontWeight: 'normal', color: '#64748b' }}>mins</span>
              </div>
            </div>
          </div>
        )}

        {/* Location Ping Stream */}
        <div>
          <h4 style={{ fontSize: '0.9rem', color: '#0f172a', fontWeight: '700', marginBottom: '0.75rem' }}>Location Ping Stream</h4>
          {pings.length === 0 ? (
            <p style={{ fontSize: '0.82rem', color: '#64748b' }}>No location points recorded for this shift.</p>
          ) : (
            <div style={{
              backgroundColor: '#f8fafc',
              borderRadius: '12px',
              border: '1px solid #e2e8f0',
              maxHeight: '200px',
              overflowY: 'auto',
              fontSize: '0.78rem'
            }}>
              {pings.map((p, idx) => (
                <div
                  key={p.id || idx}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    padding: '0.55rem 0.85rem',
                    borderBottom: '1px solid #e2e8f0'
                  }}
                >
                  <span style={{ 
                    color: p.movementType === 'traveling' ? '#059669' : p.movementType === 'delivering' ? '#0284c7' : '#d97706', 
                    fontWeight: '700', 
                    textTransform: 'capitalize' 
                  }}>
                    ● {p.movementType === 'delivering' ? 'at customer stop' : p.movementType}
                  </span>
                  <span style={{ fontFamily: 'monospace', color: '#334155', fontWeight: '600' }}>
                    {p.lat.toFixed(5)}, {p.lng.toFixed(5)} ({p.speed ? p.speed.toFixed(1) : 0} m/s)
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
