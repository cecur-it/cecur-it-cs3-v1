/**
 * Deployment profile helpers. The profile (cloud | onprem | airgap) is chosen by
 * cs3-launcher.mjs and exported to the console as CS3_PROFILE.
 *
 * - Firestore is only used when explicitly configured via FIREBASE_* variables,
 *   and never on airgap.
 * - The mock telemetry loop and demonstrative credential seeding only run when
 *   CS3_DEMO_MODE=true.
 */
export type CS3Profile = 'cloud' | 'onprem' | 'airgap';

export function getProfile(): CS3Profile {
  const raw = (process.env.CS3_PROFILE || 'cloud').trim().toLowerCase();
  return raw === 'onprem' || raw === 'airgap' ? raw : 'cloud';
}

export function isOfflineProfile(): boolean {
  return getProfile() !== 'cloud';
}

export function isAirgapProfile(): boolean {
  return getProfile() === 'airgap';
}

export function isDemoMode(): boolean {
  return process.env.CS3_DEMO_MODE === 'true';
}
