import admin from 'firebase-admin';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

// Load service account key
const serviceAccountPath = join(process.cwd(), 'serviceAccountKey.json');

if (!existsSync(serviceAccountPath)) {
  console.error('❌ Error: serviceAccountKey.json not found in dashboard folder.');
  process.exit(1);
}

const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

async function main() {
  const args = process.argv.slice(2);
  const identifier = args[0];
  const password = args[1];

  if (!identifier || !password) {
    console.log('\n🔐 Valmo Fleet — Admin Account Manager\n');
    console.log('Usage:');
    console.log('  npx tsx addAdmin.ts <email_or_phone> <password>\n');
    console.log('Examples:');
    console.log('  npx tsx addAdmin.ts admin@valmofleet.com MySecretPass123');
    console.log('  npx tsx addAdmin.ts 9876543210 MySecretPass123\n');
    process.exit(0);
  }

  // Format identifier (if phone number passed without @, format to synthetic email)
  let email = identifier.trim();
  if (!email.includes('@')) {
    const digits = email.replace(/\D/g, '');
    const cleanPhone = digits.length >= 10 ? digits.slice(-10) : digits;
    email = `${cleanPhone}@waypoint.app`;
  }

  try {
    // Check if user already exists
    let user;
    try {
      user = await admin.auth().getUserByEmail(email);
    } catch (_) {
      user = null;
    }

    if (user) {
      // Update existing admin password
      await admin.auth().updateUser(user.uid, { password });
      console.log(`\n✅ Existing Admin Password Updated Successfully!`);
      console.log(`   Account:  ${email}`);
      console.log(`   UID:      ${user.uid}\n`);
    } else {
      // Create new admin account
      user = await admin.auth().createUser({
        email,
        password,
        emailVerified: true
      });
      console.log(`\n🎉 New Admin Account Created Successfully!`);
      console.log(`   Account:  ${email}`);
      console.log(`   UID:      ${user.uid}\n`);
    }
  } catch (err: any) {
    console.error(`❌ Failed to create/update admin account:`, err.message);
  }
}

main();
