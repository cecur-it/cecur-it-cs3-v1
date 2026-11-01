import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { initializeFirestore, getFirestore, Firestore } from 'firebase/firestore';
// Runtime config injected by the server via /cs3-runtime-config.js (see server.ts).
interface RuntimeConfig {
  profile?: 'cloud' | 'onprem' | 'airgap';
  demoMode?: boolean;
  firebase?: Record<string, string | undefined> | null;
}
const runtime: RuntimeConfig = (typeof window !== 'undefined' && (window as any).__CS3_CONFIG__) || {};
export const deploymentProfile = runtime.profile || 'cloud';

const served = runtime.firebase || {};
const pick = (envValue: string | undefined, key: string) =>
  deploymentProfile === 'airgap' ? '' : envValue || served[key] || '';

// Build Firebase configuration from environment variables and runtime configuration
export const firebaseConfig = {
  apiKey: pick(import.meta.env.VITE_FIREBASE_API_KEY, 'apiKey'),
  authDomain: pick(import.meta.env.VITE_FIREBASE_AUTH_DOMAIN, 'authDomain'),
  projectId: pick(import.meta.env.VITE_FIREBASE_PROJECT_ID, 'projectId'),
  storageBucket: pick(import.meta.env.VITE_FIREBASE_STORAGE_BUCKET, 'storageBucket'),
  messagingSenderId: pick(import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID, 'messagingSenderId'),
  appId: pick(import.meta.env.VITE_FIREBASE_APP_ID, 'appId'),
  measurementId: pick(import.meta.env.VITE_FIREBASE_MEASUREMENT_ID, 'measurementId'),
  firestoreDatabaseId: pick(import.meta.env.VITE_FIREBASE_DATABASE_ID, 'firestoreDatabaseId') || '(default)',
};

// Firebase is only initialised when a usable configuration exists (never on airgap).
export const firebaseEnabled = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);

export const app: FirebaseApp | null = firebaseEnabled
  ? getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0]
  : null;

// Firebase Authentication (null when Firebase is disabled)
export const auth: Auth | null = app ? getAuth(app) : null;

// Firestore with specific database ID if configured (null when Firebase is disabled)
export const db: Firestore | null = app
  ? firebaseConfig.firestoreDatabaseId !== '(default)'
    ? initializeFirestore(app, {}, firebaseConfig.firestoreDatabaseId)
    : getFirestore(app)
  : null;

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth?.currentUser?.uid,
      email: auth?.currentUser?.email,
      emailVerified: auth?.currentUser?.emailVerified,
      isAnonymous: auth?.currentUser?.isAnonymous,
      tenantId: auth?.currentUser?.tenantId,
      providerInfo: auth?.currentUser?.providerData?.map((provider) => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}
