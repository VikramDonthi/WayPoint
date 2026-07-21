/**
 * inspectSairam.ts
 * Inspects Sairam's rider document and all shifts in Firestore
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';

const serviceAccount = JSON.parse(readFileSync('./serviceAccountKey.json', 'utf8'));
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

async function inspect() {
  const ridersSnap = await db.collection('riders').get();
  console.log('--- ALL RIDERS ---');
  for (const doc of ridersSnap.docs) {
    console.log(doc.id, doc.data());
  }

  console.log('\n--- ALL SHIFTS ---');
  const shiftsSnap = await db.collection('shifts').get();
  for (const doc of shiftsSnap.docs) {
    const data = doc.data();
    console.log(`Shift ID: ${doc.id}`);
    console.log(`  riderId: ${data.riderId}`);
    console.log(`  startTime: ${data.startTime?.toDate ? data.startTime.toDate() : data.startTime}`);
    console.log(`  endTime: ${data.endTime?.toDate ? data.endTime.toDate() : data.endTime}`);
    console.log(`  totalDistanceKm: ${data.totalDistanceKm}`);

    const pointsSnap = await doc.ref.collection('points').get();
    console.log(`  points count: ${pointsSnap.size}`);
  }
}

inspect().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
