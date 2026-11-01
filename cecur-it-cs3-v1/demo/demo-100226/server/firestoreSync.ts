import { initializeApp, getApps } from 'firebase/app';
import { initializeFirestore, doc, setDoc, getFirestore } from 'firebase/firestore';
import { generateInitialUsers } from './data/generators';
import { isAirgapProfile } from './profile';

let firestoreInstance: any = null;

export function getResolvedFirebaseConfig() {
  // Firebase configuration is supplied explicitly; onprem/airgap require FIREBASE_* values.
  return {
    apiKey: process.env.FIREBASE_API_KEY || process.env.VITE_FIREBASE_API_KEY,
    authDomain: process.env.FIREBASE_AUTH_DOMAIN || process.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.FIREBASE_APP_ID,
    measurementId: process.env.FIREBASE_MEASUREMENT_ID,
    firestoreDatabaseId: process.env.FIREBASE_DATABASE_ID || process.env.VITE_FIREBASE_DATABASE_ID || '(default)',
  };
}

/** True when Firestore may be used: never on airgap, and only with a resolved apiKey + projectId. */
export function isFirestoreEnabled(): boolean {
  if (isAirgapProfile()) return false;
  const config = getResolvedFirebaseConfig();
  return Boolean(config.apiKey && config.projectId);
}

export function getBackendFirestore() {
  if (firestoreInstance) return firestoreInstance;
  if (!isFirestoreEnabled()) {
    throw new Error('Firestore is not configured for this deployment profile.');
  }

  const config = getResolvedFirebaseConfig();
  const app = getApps().length === 0 ? initializeApp(config) : getApps()[0];
  firestoreInstance = config.firestoreDatabaseId && config.firestoreDatabaseId !== '(default)'
    ? initializeFirestore(app, {}, config.firestoreDatabaseId)
    : getFirestore(app);

  return firestoreInstance;
}

/**
 * Seeds official demonstrative credentials and initial baseline profiles into Firestore backend
 */
export async function seedFirestoreDemonstrativeCredentials() {
  if (!isFirestoreEnabled()) return;
  try {
    const db = getBackendFirestore();
    const demoUsers = generateInitialUsers();

    console.log('[FirestoreSync] Seeding official demonstrative credentials to Firestore using configured Firebase API credentials...');

    // 1. Seed users collection with demonstrative operator profiles
    for (const u of demoUsers) {
      const userDocRef = doc(db, 'users', u.id);
      await setDoc(userDocRef, {
        id: u.id,
        username: u.username,
        email: u.email,
        displayName: u.displayName,
        role: u.role,
        title: u.title,
        department: u.department,
        avatar: u.avatar,
        passwordHash: u.passwordHash,
        isDemoAccount: true,
        createdAt: u.createdAt,
        lastLogin: u.lastLogin,
      }, { merge: true });
    }

    // 2. Seed credentials collection with formal demonstrative records
    const credentialRecords = [
      {
        id: 'demo_analyst',
        username: 'analyst',
        role: 'analyst',
        clearance: 'Secret / SecOps Tier 2',
        description: 'SOC Defense Analyst with full access to SIEM alerts, Sensor telemetry, Wazuh EDR, ActivTrak risk feeds, and Asset Fusion.',
        isDemo: true,
        createdAt: '2026-01-10T08:00:00.000Z',
      },
      {
        id: 'demo_admin',
        username: 'admin',
        role: 'admin',
        clearance: 'Top Secret / Full Admin Authority',
        description: 'Chief Security Engineer & Admin with full offensive Errow scans, target allowlist management, and DB reseeding.',
        isDemo: true,
        createdAt: '2025-11-01T08:00:00.000Z',
      },
      {
        id: 'demo_auditor',
        username: 'auditor',
        role: 'auditor',
        clearance: 'Confidential / Audit Read-Only',
        description: 'GRC Lead & Compliance Auditor with immutable audit log review, compliance reporting (ISO/PCI/NIST), and read-only telemetry inspection.',
        isDemo: true,
        createdAt: '2025-12-15T08:00:00.000Z',
      },
      {
        id: 'demo_executive',
        username: 'executive',
        role: 'executive',
        clearance: 'Executive Oversight / Strategic Posture',
        description: 'Chief Information Security Officer (CISO) with high-level MTTD/MTTR metrics, threat posture tracking, and regulatory framework status.',
        isDemo: true,
        createdAt: '2025-09-01T08:00:00.000Z',
      },
    ];

    for (const cred of credentialRecords) {
      const credDocRef = doc(db, 'credentials', cred.id);
      await setDoc(credDocRef, cred, { merge: true });
    }

    console.log('[FirestoreSync] Official demonstrative credentials successfully verified and synced in Firestore backend.');
  } catch (err) {
    console.warn('[FirestoreSync] Note on Firestore credential seeding:', err);
  }
}

/**
 * Persists a newly created user profile into Firestore
 */
export async function syncUserToFirestore(user: any) {
  if (!isFirestoreEnabled()) return;
  try {
    const db = getBackendFirestore();
    const userDocRef = doc(db, 'users', user.id);
    await setDoc(userDocRef, {
      id: user.id,
      username: user.username,
      email: user.email,
      displayName: user.displayName,
      role: user.role,
      title: user.title,
      department: user.department,
      avatar: user.avatar,
      passwordHash: user.passwordHash,
      isDemoAccount: Boolean(user.isDemoAccount),
      createdAt: user.createdAt,
      lastLogin: user.lastLogin,
    }, { merge: true });
    console.log(`[FirestoreSync] Synchronized profile for user '${user.username}' (${user.id}) to Firestore.`);
  } catch (err) {
    console.warn(`[FirestoreSync] Failed to sync user '${user.username}' to Firestore:`, err);
  }
}
