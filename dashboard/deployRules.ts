/**
 * deployRules.ts
 * Deploys firestore.rules directly using the Firebase Management REST API
 * authenticated with the service account key (no firebase login needed).
 */
import { readFileSync } from 'fs';
import { initializeApp, cert } from 'firebase-admin/app';
import { google } from 'googleapis';

const serviceAccount = JSON.parse(readFileSync('./serviceAccountKey.json', 'utf8'));
const projectId = serviceAccount.project_id;

async function getAccessToken(): Promise<string> {
  const authClient = google.auth.fromJSON({
    type: 'service_account',
    client_email: serviceAccount.client_email,
    private_key: serviceAccount.private_key,
    client_id: serviceAccount.client_id,
    token_url: 'https://oauth2.googleapis.com/token',
  }) as any;
  authClient.scopes = ['https://www.googleapis.com/auth/cloud-platform'];
  const tokens = await authClient.authorize();
  return tokens.access_token!;
}

async function deployRules() {
  const rulesContent = readFileSync('../firestore.rules', 'utf8');
  const token = await getAccessToken();

  // 1. Create a new ruleset
  const createUrl = `https://firebaserules.googleapis.com/v1/projects/${projectId}/rulesets`;
  const createRes = await fetch(createUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      source: {
        files: [
          {
            name: 'firestore.rules',
            content: rulesContent,
          }
        ]
      }
    }),
  });

  if (!createRes.ok) {
    const err = await createRes.text();
    throw new Error(`Failed to create ruleset: ${createRes.status} ${err}`);
  }

  const ruleset = await createRes.json() as { name: string };
  console.log('✅ Ruleset created:', ruleset.name);

  // 2. Update the release to point to the new ruleset
  const releaseUrl = `https://firebaserules.googleapis.com/v1/projects/${projectId}/releases/cloud.firestore`;
  const releaseRes = await fetch(releaseUrl, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      release: {
        name: `projects/${projectId}/releases/cloud.firestore`,
        rulesetName: ruleset.name,
      }
    }),
  });

  if (!releaseRes.ok) {
    const err = await releaseRes.text();
    throw new Error(`Failed to update release: ${releaseRes.status} ${err}`);
  }

  const release = await releaseRes.json();
  console.log('✅ Rules deployed successfully!');
  console.log('   Release:', (release as any).name);
  console.log('   Ruleset:', (release as any).rulesetName);
  console.log('\n🎉 Firestore rules are live. Refresh the dashboard to verify.');
}

deployRules().then(() => process.exit(0)).catch(err => {
  console.error('❌ Deploy failed:', err.message);
  process.exit(1);
});
