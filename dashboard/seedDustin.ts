/**
 * seedDustin.ts
 * Creates a realistic test rider "Dustin" with 7 daily shifts over the past week
 * in Jangon, Telangana – complete with route variation, rest stops, and delivery moments.
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp, FieldValue } from 'firebase-admin/firestore';
import { v4 as uuidv4 } from 'uuid';
import { readFileSync } from 'fs';

const serviceAccount = JSON.parse(readFileSync('./serviceAccountKey.json', 'utf8'));
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

// ─── Jangon area waypoints (realistic neighbourhood grid) ────────────────────
// Real-ish roads in and around Jangon, Telangana
const WAYPOINTS = [
  { lat: 17.3850, lng: 78.4740 }, // Jangon centre / market
  { lat: 17.3880, lng: 78.4780 }, // North market road
  { lat: 17.3910, lng: 78.4810 }, // NH bypass junction
  { lat: 17.3860, lng: 78.4830 }, // East colony
  { lat: 17.3820, lng: 78.4800 }, // South main road
  { lat: 17.3800, lng: 78.4750 }, // Bus stand
  { lat: 17.3830, lng: 78.4700 }, // Panchayat area
  { lat: 17.3870, lng: 78.4680 }, // West village lane
  { lat: 17.3900, lng: 78.4720 }, // Mandal office area
  { lat: 17.3920, lng: 78.4760 }, // School / residential
];

// Linear interpolation between two waypoints
function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }

function jitter(v: number, amount = 0.0003) {
  return v + (Math.random() - 0.5) * amount;
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

// ─── Route generator ─────────────────────────────────────────────────────────
interface Ping {
  lat: number;
  lng: number;
  timestamp: number; // epoch ms
  speed: number;     // m/s
  movementType: 'traveling' | 'resting' | 'delivering';
}

/**
 * Generates a realistic route for one shift.
 * @param shiftStartMs  shift start epoch ms
 * @param durationHours shift duration in hours
 */
function generateShiftRoute(shiftStartMs: number, durationHours: number): Ping[] {
  const pings: Ping[] = [];
  let currentMs = shiftStartMs;
  const shiftEndMs = shiftStartMs + durationHours * 3600_000;

  // Pick a random starting waypoint
  let wpIdx = Math.floor(Math.random() * WAYPOINTS.length);
  let pos = { lat: jitter(WAYPOINTS[wpIdx].lat), lng: jitter(WAYPOINTS[wpIdx].lng) };

  while (currentMs < shiftEndMs) {
    // Push current position ping
    pings.push({
      lat: pos.lat,
      lng: pos.lng,
      timestamp: currentMs,
      speed: 0,
      movementType: 'traveling',
    });

    // Decide segment type: travel (60%), rest (20%), deliver (20%)
    const roll = Math.random();

    if (roll < 0.60) {
      // ── Traveling segment ──────────────────────────────────────────────────
      // Pick next waypoint
      const nextWpIdx = (wpIdx + 1 + Math.floor(Math.random() * (WAYPOINTS.length - 1))) % WAYPOINTS.length;
      const dest = WAYPOINTS[nextWpIdx];

      const numSteps = 4 + Math.floor(Math.random() * 6); // 4–9 micro-steps between waypoints
      const stepDurationMs = (60 + Math.random() * 120) * 1000; // 1–3 min per step
      const speedMs = 6 + Math.random() * 8; // 6–14 m/s (22–50 km/h)

      for (let s = 1; s <= numSteps && currentMs < shiftEndMs; s++) {
        const t = s / numSteps;
        const lat = jitter(lerp(pos.lat, dest.lat, t), 0.0002);
        const lng = jitter(lerp(pos.lng, dest.lng, t), 0.0002);
        currentMs += stepDurationMs;
        pings.push({ lat, lng, timestamp: currentMs, speed: speedMs, movementType: 'traveling' });
      }

      pos = { lat: jitter(dest.lat, 0.0002), lng: jitter(dest.lng, 0.0002) };
      wpIdx = nextWpIdx;

    } else if (roll < 0.80) {
      // ── Rest stop ──────────────────────────────────────────────────────────
      const restMs = (15 + Math.random() * 30) * 60_000; // 15–45 min
      const restEnd = Math.min(currentMs + restMs, shiftEndMs);
      const interval = 5 * 60_000; // ping every 5 min during rest
      let t = currentMs + interval;
      while (t < restEnd) {
        pings.push({ lat: jitter(pos.lat, 0.00005), lng: jitter(pos.lng, 0.00005), timestamp: t, speed: 0, movementType: 'resting' });
        t += interval;
      }
      currentMs = restEnd;

    } else {
      // ── Delivery stop ──────────────────────────────────────────────────────
      const deliverMs = (5 + Math.random() * 15) * 60_000; // 5–15 min
      const deliverEnd = Math.min(currentMs + deliverMs, shiftEndMs);
      const interval = 3 * 60_000;
      let t = currentMs + interval;
      while (t < deliverEnd) {
        pings.push({ lat: jitter(pos.lat, 0.00005), lng: jitter(pos.lng, 0.00005), timestamp: t, speed: 0, movementType: 'delivering' });
        t += interval;
      }
      currentMs = deliverEnd;
    }
  }

  return pings;
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  const riderId = uuidv4();
  const now = Date.now();

  // Create Dustin
  await db.collection('riders').doc(riderId).set({
    name: 'Dustin',
    phone: '9123456780',
    status: 'offline',
    totalDistanceKm: 0,
    createdAt: FieldValue.serverTimestamp(),
  });
  console.log(`✅ Rider "Dustin" created – ID: ${riderId}`);

  // 7 shifts over past 7 days (Mon–Sun, 6–10h each, skip 1 day randomly as day-off)
  const DAY_MS = 24 * 3600_000;
  let lifetimeKm = 0;
  let lastLocation: { lat: number; lng: number; timestamp: any } | null = null;

  for (let dayOffset = 6; dayOffset >= 0; dayOffset--) {
    // ~15% chance day off
    if (dayOffset !== 0 && Math.random() < 0.15) {
      console.log(`  ⛔ Day ${7 - dayOffset}: day off`);
      continue;
    }

    const shiftDurationHours = 6 + Math.random() * 4; // 6–10 hours
    // Shift starts between 08:00 and 10:00
    const startHourMs = (8 + Math.floor(Math.random() * 2)) * 3600_000;
    const shiftStartMs = now - dayOffset * DAY_MS - (now % DAY_MS) + startHourMs;
    const shiftEndMs = shiftStartMs + shiftDurationHours * 3600_000;

    const shiftId = uuidv4();
    const pings = generateShiftRoute(shiftStartMs, shiftDurationHours);

    // Compute shift distance
    let shiftKm = 0;
    for (let i = 1; i < pings.length; i++) {
      shiftKm += haversineKm(pings[i - 1].lat, pings[i - 1].lng, pings[i].lat, pings[i].lng);
    }
    lifetimeKm += shiftKm;

    // Write shift doc
    const isToday = dayOffset === 0;
    await db.collection('shifts').doc(shiftId).set({
      riderId,
      startTime: Timestamp.fromMillis(shiftStartMs),
      endTime: isToday ? null : Timestamp.fromMillis(shiftEndMs),
      totalDistanceKm: parseFloat(shiftKm.toFixed(2)),
    });

    // Write points in batches of 400
    const BATCH_SIZE = 400;
    for (let b = 0; b < pings.length; b += BATCH_SIZE) {
      const batch = db.batch();
      const slice = pings.slice(b, b + BATCH_SIZE);
      for (const p of slice) {
        const ref = db.collection('shifts').doc(shiftId).collection('points').doc();
        batch.set(ref, {
          riderId,
          lat: p.lat,
          lng: p.lng,
          timestamp: Timestamp.fromMillis(p.timestamp),
          speed: p.speed,
          movementType: p.movementType,
        });
      }
      await batch.commit();
    }

    // Track last known location (most recent shift's last ping)
    if (dayOffset === 0 && pings.length > 0) {
      const last = pings[pings.length - 1];
      lastLocation = {
        lat: last.lat,
        lng: last.lng,
        timestamp: Timestamp.fromMillis(last.timestamp),
      };
    }

    console.log(`  ✅ Day ${7 - dayOffset}: shift ${shiftId.substring(0, 8)} – ${pings.length} pings, ${shiftKm.toFixed(1)} km, ${shiftDurationHours.toFixed(1)}h`);
  }

  // Update rider with summary
  const lastPingOfLatestShift = lastLocation || (() => {
    const wp = WAYPOINTS[0];
    return { lat: wp.lat, lng: wp.lng, timestamp: Timestamp.fromMillis(now) };
  })();

  await db.collection('riders').doc(riderId).update({
    totalDistanceKm: parseFloat(lifetimeKm.toFixed(2)),
    status: 'offline',
    lastLocation: lastPingOfLatestShift,
  });

  console.log(`\n🎉 Dustin seeded! Lifetime distance: ${lifetimeKm.toFixed(2)} km`);
  console.log(`📍 Last location: ${lastPingOfLatestShift.lat.toFixed(5)}, ${lastPingOfLatestShift.lng.toFixed(5)}`);
}

main().then(() => process.exit()).catch(err => { console.error('❌', err); process.exit(1); });
