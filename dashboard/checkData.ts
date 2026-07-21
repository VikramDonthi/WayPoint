// checkData.ts
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';

const serviceAccountPath = './serviceAccountKey.json';
const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

async function main() {
  const ridersSnap = await db.collection('riders').get();
  console.log('Riders:');
  ridersSnap.forEach(doc => {
    console.log(doc.id, doc.data());
  });

  const shiftsSnap = await db.collection('shifts').get();
  console.log('Shifts:');
  for (const doc of shiftsSnap.docs) {
    console.log('Shift', doc.id, doc.data());
    const pointsSnap = await db.collection('shifts').doc(doc.id).collection('points').orderBy('timestamp').limit(5).get();
    console.log('  First few points:');
    pointsSnap.forEach(p => console.log('    ', p.id, p.data()));
  }
}

main().then(() => process.exit()).catch(err => { console.error(err); process.exit(1); });
