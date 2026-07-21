// seedTestData.ts
// This script seeds Firestore with a test rider, a 1‑week shift, and simulated location pings in Jangon, Telangana.
// ------------------------------------------------------------
// Prerequisites:
// 1. Install Firebase Admin SDK in the dashboard project: `npm install firebase-admin`.
// 2. Obtain a service account JSON key from your Firebase project (Console → Project Settings → Service Accounts → Generate new private key).
// 3. Save the key file somewhere reachable, e.g. `./serviceAccountKey.json`.
// 4. Update the `serviceAccountPath` variable below with the correct path.
// 5. Run the script with `npx ts-node seedTestData.ts` (or compile to JS and run with `node`).
// ------------------------------------------------------------

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp, FieldValue } from 'firebase-admin/firestore';
import { v4 as uuidv4 } from 'uuid';
import { readFileSync } from 'fs';

// ==== Configuration ==== //
const serviceAccountPath = './serviceAccountKey.json'; // <--- UPDATE THIS PATH
const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));

initializeApp({
  credential: cert(serviceAccount),
});

const db = getFirestore();

// Helper to generate a random point within ~0.01° (~1km) of Jangon centre
function randomJangonPoint() {
  const latCenter = 17.3850;
  const lngCenter = 78.4740;
  const delta = 0.01; // approx 1 km
  const lat = latCenter + (Math.random() - 0.5) * delta;
  const lng = lngCenter + (Math.random() - 0.5) * delta;
  return { lat, lng };
}

async function main() {
  try {
    // 1️⃣ Create a test rider
    const riderId = uuidv4();
    const riderData = {
      name: 'Test Rider',
      phone: '9876543210',
      status: 'offline', // will be updated when shift starts
      createdAt: FieldValue.serverTimestamp(),
      totalDistanceKm: 0,
    } as any;

    await db.collection('riders').doc(riderId).set(riderData);
    console.log('✅ Rider created with ID:', riderId);

    // 2️⃣ Create a 1‑week shift for that rider
    const now = Timestamp.now();
    const oneWeekAgo = Timestamp.fromMillis(now.toMillis() - 7 * 24 * 60 * 60 * 1000);
    const shiftId = uuidv4();
    const shiftData = {
      riderId,
      startTime: oneWeekAgo,
      endTime: now,
      totalDistanceKm: 0, // will be updated after generating pings
    } as any;

    await db.collection('shifts').doc(shiftId).set(shiftData);
    console.log('✅ Shift created with ID:', shiftId);

    // 3️⃣ Simulate location pings (one per hour over the week)
    const pointsRef = db.collection('shifts').doc(shiftId).collection('points');
    let cumulativeDistance = 0;
    let prevPoint: { lat: number; lng: number } | null = null;
    const hourMs = 60 * 60 * 1000;
    for (let i = 0; i <= 7 * 24; i++) { // 0..168 hours
      const timestamp = Timestamp.fromMillis(oneWeekAgo.toMillis() + i * hourMs);
      const { lat, lng } = randomJangonPoint();

      // Simple haversine distance to accumulate km (approx)
      const movementType = prevPoint ? 'traveling' : 'resting';
      if (prevPoint) {
        const R = 6371; // km
        const dLat = ((lat - prevPoint.lat) * Math.PI) / 180;
        const dLng = ((lng - prevPoint.lng) * Math.PI) / 180;
        const a =
          Math.sin(dLat / 2) * Math.sin(dLat / 2) +
          Math.cos((prevPoint.lat * Math.PI) / 180) *
            Math.cos((lat * Math.PI) / 180) *
            Math.sin(dLng / 2) *
            Math.sin(dLng / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        const distance = R * c; // km
        cumulativeDistance += distance;
      }

      await pointsRef.add({
        riderId,
        lat,
        lng,
        timestamp,
        speed: 0, // placeholder – you can compute speed if needed
        movementType,
      });

      prevPoint = { lat, lng };
    }

    // 4️⃣ Update shift and rider with total distance
    await db.collection('shifts').doc(shiftId).update({ totalDistanceKm: cumulativeDistance });
    // Update rider with total distance, current shift, status, and latest location
    const lastLocation = prevPoint ? { lat: prevPoint.lat, lng: prevPoint.lng, timestamp: Timestamp.fromMillis(oneWeekAgo.toMillis() + 7*24*60*60*1000) } : null;
    await db.collection('riders').doc(riderId).update({
      totalDistanceKm: cumulativeDistance,
      currentShiftId: shiftId,
      status: 'traveling',
      lastLocation,
    });

    console.log('✅ Generated', 7 * 24 + 1, 'pings covering a week.');
    console.log('📍 Total simulated distance:', cumulativeDistance.toFixed(2), 'km');
  } catch (err) {
    console.error('❌ Error seeding data:', err);
  } finally {
    process.exit();
  }
}

main();
