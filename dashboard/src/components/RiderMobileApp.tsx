import React, { useState, useEffect, useRef } from 'react';
import { Navigation, Play, Square, LogOut, MapPin, AlertCircle } from 'lucide-react';
import { auth, db } from '../firebase';
import { signInWithEmailAndPassword, signOut as firebaseSignOut, onAuthStateChanged, type User } from 'firebase/auth';
import { doc, addDoc, collection, updateDoc, serverTimestamp, Timestamp } from 'firebase/firestore';

export const RiderMobileApp: React.FC = () => {
  const [riderUser, setRiderUser] = useState<User | null>(null);
  const [mobile, setMobile] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [activeShiftId, setActiveShiftId] = useState<string | null>(
    localStorage.getItem('waypoint_active_shift_id')
  );

  const [lastLocation, setLastLocation] = useState<{ lat: number; lng: number; speed: number; movementType: string } | null>(null);

  // Automatic Spatial-Temporal Dwell Tracking Refs
  const watchIdRef = useRef<number | null>(null);
  const dwellAnchorRef = useRef<{ lat: number; lng: number; timestamp: number } | null>(null);
  const lastLocationRef = useRef<{ lat: number; lng: number; timestamp: number } | null>(null);

  useEffect(() => {
    if (!auth) return;
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setRiderUser(user);
    });
    return () => unsubscribe();
  }, []);

  const handleRiderLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const cleanPhone = mobile.trim().replace(/\D/g, '');
    const phone10 = cleanPhone.length >= 10 ? cleanPhone.slice(-10) : cleanPhone;
    const email = mobile.includes('@') ? mobile.trim() : `${phone10}@waypoint.app`;

    try {
      if (!auth) throw new Error('Firebase Auth not initialized');
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err: any) {
      console.error('Rider login failed', err);
      setError('Login failed. Verify mobile number and password.');
    } finally {
      setLoading(false);
    }
  };

  const handleStartShift = async () => {
    if (!riderUser || !db) return;
    setLoading(true);

    try {
      // 1. Create shift document
      const shiftRef = await addDoc(collection(db, 'shifts'), {
        riderId: riderUser.uid,
        startTime: serverTimestamp(),
        endTime: null
      });

      const shiftId = shiftRef.id;
      setActiveShiftId(shiftId);
      localStorage.setItem('waypoint_active_shift_id', shiftId);

      // 2. Update rider status
      await updateDoc(doc(db, 'riders', riderUser.uid), {
        status: 'delivering',
        currentShiftId: shiftId
      });

      // 3. Start GPS tracking
      startLocationTracking(shiftId, riderUser.uid);
    } catch (err: any) {
      setError('Failed to start shift: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEndShift = async () => {
    if (!riderUser || !db || !activeShiftId) return;
    setLoading(true);

    try {
      // Stop GPS
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }

      // Update shift end time
      await updateDoc(doc(db, 'shifts', activeShiftId), {
        endTime: serverTimestamp()
      });

      // Update rider status
      await updateDoc(doc(db, 'riders', riderUser.uid), {
        status: 'offline',
        currentShiftId: null
      });

      setActiveShiftId(null);
      localStorage.removeItem('waypoint_active_shift_id');
      setLastLocation(null);
    } catch (err: any) {
      setError('Failed to end shift: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const startLocationTracking = (shiftId: string, riderId: string) => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your mobile browser');
      return;
    }

    watchIdRef.current = navigator.geolocation.watchPosition(
      async (position) => {
        const { latitude: lat, longitude: lng, speed: rawSpeed } = position.coords;
        const now = position.timestamp;

        const speed = rawSpeed || computeDerivedSpeed(lat, lng, now);
        const movementType = determineAutomaticMovementType(lat, lng, speed, now);

        setLastLocation({ lat, lng, speed, movementType });

        if (!db) return;

        try {
          // Write point to pings/{shiftId}/points
          await addDoc(collection(db, 'pings', shiftId, 'points'), {
            riderId,
            lat,
            lng,
            speed,
            movementType,
            timestamp: Timestamp.fromMillis(now)
          });

          // Update rider document
          await updateDoc(doc(db, 'riders', riderId), {
            status: movementType,
            lastLocation: {
              lat,
              lng,
              timestamp: Timestamp.fromMillis(now)
            }
          });
        } catch (e) {
          console.error('Failed to log location ping', e);
        }
      },
      (geoErr) => {
        console.error('GPS Watch error', geoErr);
        setError('GPS error: ' + geoErr.message);
      },
      {
        enableHighAccuracy: true,
        timeout: 20000,
        maximumAge: 10000
      }
    );
  };

  const computeDerivedSpeed = (lat: number, lng: number, timestamp: number): number => {
    const last = lastLocationRef.current;
    lastLocationRef.current = { lat, lng, timestamp };
    if (!last) return 0;

    const deltaSec = (timestamp - last.timestamp) / 1000;
    if (deltaSec <= 0) return 0;

    // Approximate distance formula in meters
    const R = 6371000; // Earth radius in meters
    const dLat = (lat - last.lat) * Math.PI / 180;
    const dLng = (lng - last.lng) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(last.lat * Math.PI / 180) * Math.cos(lat * Math.PI / 180) *
              Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distanceMeters = R * c;

    return distanceMeters / deltaSec;
  };

  const determineAutomaticMovementType = (lat: number, lng: number, speed: number, timestamp: number): string => {
    if (speed > 0.5) {
      dwellAnchorRef.current = null;
      return 'traveling';
    }

    const anchor = dwellAnchorRef.current;
    if (!anchor) {
      dwellAnchorRef.current = { lat, lng, timestamp };
      return 'delivering';
    }

    // Check distance from anchor
    const R = 6371000;
    const dLat = (lat - anchor.lat) * Math.PI / 180;
    const dLng = (lng - anchor.lng) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(anchor.lat * Math.PI / 180) * Math.cos(lat * Math.PI / 180) *
              Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distanceMeters = R * c;

    if (distanceMeters > 60) {
      dwellAnchorRef.current = null;
      return 'traveling';
    }

    const dwellDurationMinutes = (timestamp - anchor.timestamp) / (1000 * 60);

    return dwellDurationMinutes <= 30 ? 'delivering' : 'resting';
  };

  if (!riderUser) {
    return (
      <div style={{
        minHeight: '100vh',
        backgroundColor: '#0b0f17',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.5rem'
      }}>
        <div style={{
          backgroundColor: '#131b29',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '20px',
          width: '100%',
          maxWidth: '380px',
          padding: '2rem 1.5rem'
        }}>
          <div style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
            <div style={{
              background: 'linear-gradient(135deg, #00f2fe 0%, #4facfe 100%)',
              width: '50px',
              height: '50px',
              borderRadius: '14px',
              margin: '0 auto 0.75rem auto',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#0b0f17'
            }}>
              <Navigation size={26} style={{ transform: 'rotate(45deg)' }} />
            </div>
            <h2 style={{ fontSize: '1.4rem', fontWeight: '800', color: '#f8fafc' }}>WAYPOINT RIDER</h2>
            <p style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '2px' }}>Mobile Web Tracker</p>
          </div>

          {error && (
            <div style={{
              backgroundColor: 'rgba(244, 63, 94, 0.15)',
              border: '1px solid rgba(244, 63, 94, 0.3)',
              borderRadius: '10px',
              padding: '0.75rem',
              marginBottom: '1rem',
              color: '#f43f5e',
              fontSize: '0.82rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}>
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleRiderLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', color: '#94a3b8', marginBottom: '4px' }}>
                Mobile Number
              </label>
              <input
                type="tel"
                placeholder="e.g. 9876543210"
                value={mobile}
                onChange={(e) => setMobile(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  backgroundColor: '#0b0f17',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '10px',
                  color: '#f8fafc',
                  outline: 'none'
                }}
                required
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', color: '#94a3b8', marginBottom: '4px' }}>
                Password
              </label>
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  backgroundColor: '#0b0f17',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '10px',
                  color: '#f8fafc',
                  outline: 'none'
                }}
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                marginTop: '0.5rem',
                padding: '0.85rem',
                borderRadius: '10px',
                backgroundColor: '#38bdf8',
                color: '#0b0f17',
                border: 'none',
                fontWeight: '700',
                fontSize: '0.95rem',
                cursor: 'pointer'
              }}
            >
              {loading ? 'Logging in...' : 'Sign In as Rider'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#0b0f17',
      padding: '1.25rem',
      display: 'flex',
      flexDirection: 'column',
      gap: '1.25rem',
      maxWidth: '450px',
      margin: '0 auto'
    }}>
      {/* Header Bar */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: '#131b29',
        padding: '1rem',
        borderRadius: '16px',
        border: '1px solid rgba(255, 255, 255, 0.08)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: '12px',
            backgroundColor: '#0b0f17',
            color: '#38bdf8',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 'bold'
          }}>
            {riderUser.email?.substring(0, 1).toUpperCase()}
          </div>
          <div>
            <h3 style={{ fontSize: '1rem', fontWeight: '700', color: '#f8fafc' }}>
              Rider ID: {riderUser.uid.substring(0, 8)}
            </h3>
            <p style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{riderUser.email}</p>
          </div>
        </div>

        <button
          onClick={() => {
            if (activeShiftId) handleEndShift();
            if (auth) firebaseSignOut(auth);
          }}
          title="Logout"
          style={{ background: 'none', border: 'none', color: '#f43f5e', cursor: 'pointer' }}
        >
          <LogOut size={20} />
        </button>
      </div>

      {/* Shift Status Card */}
      <div style={{
        backgroundColor: '#131b29',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: '16px',
        padding: '1.5rem',
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '1rem'
      }}>
        <div style={{
          padding: '6px 14px',
          borderRadius: '20px',
          fontSize: '0.82rem',
          fontWeight: '700',
          backgroundColor: activeShiftId ? 'rgba(16, 185, 129, 0.15)' : 'rgba(100, 116, 139, 0.15)',
          color: activeShiftId ? '#10b981' : '#94a3b8',
          border: `1px solid ${activeShiftId ? 'rgba(16, 185, 129, 0.3)' : 'rgba(100, 116, 139, 0.3)'}`
        }}>
          {activeShiftId ? '● ON DUTY — GPS TRACKING ACTIVE' : 'OFF DUTY — INACTIVE'}
        </div>

        {!activeShiftId ? (
          <button
            onClick={handleStartShift}
            disabled={loading}
            style={{
              width: '100%',
              padding: '1rem',
              borderRadius: '12px',
              backgroundColor: '#38bdf8',
              color: '#0b0f17',
              border: 'none',
              fontWeight: '800',
              fontSize: '1.1rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              boxShadow: '0 0 20px rgba(56, 189, 248, 0.3)'
            }}
          >
            <Play size={20} fill="#0b0f17" />
            START SHIFT
          </button>
        ) : (
          <button
            onClick={handleEndShift}
            disabled={loading}
            style={{
              width: '100%',
              padding: '1rem',
              borderRadius: '12px',
              backgroundColor: '#f43f5e',
              color: '#ffffff',
              border: 'none',
              fontWeight: '800',
              fontSize: '1.1rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              boxShadow: '0 0 20px rgba(244, 63, 94, 0.3)'
            }}
          >
            <Square size={20} fill="#ffffff" />
            END SHIFT
          </button>
        )}
      </div>

      {/* Live Location Telemetry */}
      {lastLocation && (
        <div style={{
          backgroundColor: '#0b0f17',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '16px',
          padding: '1.25rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.75rem',
          fontSize: '0.85rem'
        }}>
          <h4 style={{ fontSize: '0.85rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Live Telemetry
          </h4>

          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: '#64748b', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <MapPin size={16} color="#38bdf8" /> Coordinates
            </span>
            <span style={{ fontFamily: 'monospace', color: '#f8fafc' }}>
              {lastLocation.lat.toFixed(5)}, {lastLocation.lng.toFixed(5)}
            </span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: '#64748b' }}>Speed</span>
            <span style={{ color: '#cbd5e1' }}>
              {(lastLocation.speed * 3.6).toFixed(1)} km/h ({lastLocation.speed.toFixed(1)} m/s)
            </span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: '#64748b' }}>Auto Inferred Status</span>
            <span style={{
              color: lastLocation.movementType === 'traveling' ? '#10b981' : lastLocation.movementType === 'delivering' ? '#00f2fe' : '#f59e0b',
              fontWeight: '700',
              textTransform: 'uppercase'
            }}>
              {lastLocation.movementType === 'delivering' ? 'At Delivery Stop' : lastLocation.movementType}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
