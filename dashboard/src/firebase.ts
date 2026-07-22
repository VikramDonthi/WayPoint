import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  signOut as firebaseSignOut, 
  createUserWithEmailAndPassword,
  type Auth
} from 'firebase/auth';
import { 
  getFirestore, 
  doc, 
  setDoc, 
  serverTimestamp, 
  type Firestore
} from 'firebase/firestore';
import type { FirebaseAppConfig } from './types';

const STORAGE_KEY = 'waypoint_firebase_config';

export const DEFAULT_CONFIG: FirebaseAppConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyAiA8ijqfKAF_xs0B-ug3Fkdfdp_Tm2yls",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "waypoint-82d41.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "waypoint-82d41",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "waypoint-82d41.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "1044006759008",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:1044006759008:android:9ed658ed99ac09a222b105"
};

export const normalizePhone = (phone: string): string => {
  const digits = phone.trim().replace(/\D/g, '');
  return digits.length >= 10 ? digits.slice(-10) : digits;
};

export const getStoredConfig = (): FirebaseAppConfig => {
  return DEFAULT_CONFIG;
};

export const saveStoredConfig = (config: FirebaseAppConfig) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
};

let primaryApp: FirebaseApp | undefined;
export let auth: Auth | undefined;
export let db: Firestore | undefined;

export const initFirebase = (config: FirebaseAppConfig = getStoredConfig()) => {
  try {
    if (!config.apiKey || config.apiKey.trim() === '') {
      console.warn("Firebase config is empty. Click the settings gear to configure your Firebase project.");
      return null;
    }

    if (getApps().length === 0) {
      primaryApp = initializeApp(config);
    } else {
      primaryApp = getApp();
    }
    auth = getAuth(primaryApp);
    db = getFirestore(primaryApp);
    return { primaryApp, auth, db };
  } catch (error) {
    console.error("Error initializing Firebase app:", error);
    return null;
  }
};

// Initial setup
initFirebase();

/**
 * Creates a new Rider account using a secondary Firebase Auth instance.
 * This guarantees the current Admin auth session remains completely uninterrupted.
 */
export const createRiderAccount = async (phone: string, password: string, name: string) => {
  const cleanPhone = normalizePhone(phone);
  const config = getStoredConfig();

  if (!db) {
    throw new Error("Firestore is not initialized. Please configure your Firebase project settings.");
  }

  // Find or initialize secondary Firebase app
  let secondaryApp: FirebaseApp;
  const existingSecondary = getApps().find(app => app.name === 'SecondaryApp');
  if (existingSecondary) {
    secondaryApp = existingSecondary;
  } else {
    secondaryApp = initializeApp(config, 'SecondaryApp');
  }

  const secondaryAuth = getAuth(secondaryApp);
  const syntheticEmail = `${cleanPhone}@waypoint.app`;

  try {
    // 1. Create auth user in secondary instance
    const userCredential = await createUserWithEmailAndPassword(secondaryAuth, syntheticEmail, password);
    const riderUid = userCredential.user.uid;

    // 2. Create rider document in Firestore using primary Firestore instance
    await setDoc(doc(db, 'riders', riderUid), {
      name: name.trim(),
      phone: cleanPhone,
      status: 'offline',
      lastLocation: null,
      currentShiftId: null,
      createdAt: serverTimestamp()
    });

    // 3. Immediately sign out of secondary auth so it remains clean
    await firebaseSignOut(secondaryAuth);

    return {
      uid: riderUid,
      phone: cleanPhone,
      name: name.trim(),
      password
    };
  } catch (error: any) {
    // Clean up secondary auth state if error occurred
    try { await firebaseSignOut(secondaryAuth); } catch (_) {}
    throw error;
  }
};

/**
 * Admin Login Helper using Mobile/Email & Password
 */
export const loginAdmin = async (identifier: string, password: string) => {
  if (!auth) {
    throw new Error("Firebase Auth is not initialized. Please configure your Firebase project settings.");
  }
  let email = identifier.trim();
  if (!email.includes('@')) {
    email = `${normalizePhone(identifier)}@waypoint.app`;
  }
  return await signInWithEmailAndPassword(auth, email, password);
};

export const logoutAdmin = async () => {
  if (auth) {
    return await firebaseSignOut(auth);
  }
};
