import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Lightweight API fetch wrapper that auto-refreshes Firebase session cookie on 401
export async function apiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const res = await fetch(input, { ...init, credentials: 'include' });
  if (res.status !== 401) return res;

  try {
    // Dynamically get Firebase Auth without hard-coupling imports here
    const { getAuth } = await import('firebase/auth');
    const { getApps, getApp, initializeApp } = await import('firebase/app');
    const { firebaseConfig } = await import('@/lib/firebase');

    const app = getApps().length ? getApp() : initializeApp(firebaseConfig as any);
    const auth = getAuth(app);
    const user = auth.currentUser;
    if (!user) return res; // not signed in; propagate 401

    const idToken = await user.getIdToken(true);
    await fetch('/api/auth/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken }),
      credentials: 'include',
    });

    // Retry original request
    return fetch(input, { ...init, credentials: 'include' });
  } catch (_) {
    return res; // If refresh fails, return original 401
  }
}
