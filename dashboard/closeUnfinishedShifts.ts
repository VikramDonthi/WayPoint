/**
 * closeUnfinishedShifts.ts
 * Scans Firestore for shifts with `endTime == null` and closes any older ones.
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';

const serviceAccount = JSON.parse(readFileSync('./serviceAccountKey.json', 'utf8'));
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

async function cleanShifts() {
  const shiftsSnap = await db.collection('shifts').get();
  let updatedCount = 0;

  for (const doc of shiftsSnap.docs) {
    const data = doc.data();
    if (data.endTime == null) {
      const startTimeMs = data.startTime?.toMillis ? data.startTime.toMillis() : Date.now();
      const endTime = Timestamp.fromDate(new Date());
      await doc.ref.update({ endTime });
      console.log(`✅ Closed open shift ${doc.id} for rider ${data.riderId}`);
      updatedCount++;
    }
  }

  // Also check riders whose status might be stuck on resting or traveling without an active shift
  const ridersSnap = await db.collection('riders').get();
  for (const doc of ridersSnap.docs) {
    const data = doc.data();
    if (data.currentShiftId) {
      const shiftDoc = await db.collection('shifts').doc(data.currentShiftId).get();
      if (!shiftDoc.exists || shiftDoc.data()?.endTime != null) {
        await doc.ref.update({ status: 'offline', currentShiftId: null });
        console.log(`✅ Reset rider ${data.name || doc.id} status to offline`);
      }
    }
  }

  console.log(`\n🎉 Cleanup complete! Closed ${updatedCount} dangling shift(s).`);
}

cleanShifts().then(() => process.exit(0)).catch(err => {
  console.error('❌', err);
  process.exit(1);
});
