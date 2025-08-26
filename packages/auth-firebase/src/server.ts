import { initializeApp, getApps, App, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

const serviceAccount = {
  projectId: process.env.FIREBASE_PROJECT_ID,
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
};

const adminApp = (): App => {
  if (getApps().length) {
    return getApps()[0];
  }
  // Only initialize if all necessary environment variables are set
  if (serviceAccount.projectId && serviceAccount.clientEmail && serviceAccount.privateKey) {
    return initializeApp({
      credential: cert(serviceAccount),
    });
  }
  // Fallback for environments where Firebase Admin is not configured (e.g., client-side build)
  // This should ideally not be reached if imports are handled correctly by Next.js
  console.warn('Firebase Admin SDK not initialized: Missing environment variables.');
  // Return a dummy app or throw an error if strict initialization is required
  // For now, we'll return a minimal app to avoid build errors, but it won't function.
  return {
    name: '[DEFAULT]',
    options: {},
    auth: () => ({} as any), // Dummy auth function
    // Add other dummy methods as needed to satisfy the App type
  } as App;
};

export const createSessionCookie = async (idToken: string, expiresIn: number) => {
  const auth = getAuth(adminApp());
  return auth.createSessionCookie(idToken, { expiresIn });
};

export const verifySessionCookie = async (cookie: string) => {
  const auth = getAuth(adminApp());
  return auth.verifySessionCookie(cookie, true);
};

export const revokeSessionCookie = async (sessionCookie: string) => {
  const auth = getAuth(adminApp());
  const decodedClaims = await auth.verifySessionCookie(sessionCookie);
  return auth.revokeRefreshTokens(decodedClaims.sub);
};
