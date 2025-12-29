'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { getAuth, onAuthStateChanged, User, Auth, signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile, fetchSignInMethodsForEmail } from 'firebase/auth';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { firebaseConfig } from '@/lib/firebase';
import { AuthContext, useAuth as useCoreAuth } from '@pixell/auth-core';
// Email link helpers removed in favor of email+password



export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [auth, setAuth] = useState<Auth | null>(null); // Use useState for auth
  const router = useRouter();

  useEffect(() => {
    const firebaseApp = !getApps().length ? initializeApp(firebaseConfig) : getApp();
    const firebaseAuth = getAuth(firebaseApp);
    setAuth(firebaseAuth); // Set auth instance
    const unsubscribe = onAuthStateChanged(firebaseAuth, (user) => {
      setUser(user);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    if (!auth) throw new Error('Authentication not initialized');
    try {
      setLoading(true);
      const cred = await signInWithEmailAndPassword(auth, email, password);
      const idToken = await cred.user.getIdToken();
      await fetch('/api/auth/session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idToken }) });
      router.replace('/');
    } catch (error) {
      // Surface error to caller so UI can display message
      console.error('Sign-in failed', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const signUp = async (email: string, password: string, displayName?: string) => {
    if (!auth) throw new Error('Authentication not initialized');
    try {
      setLoading(true);
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      if (displayName) {
        try { await updateProfile(cred.user, { displayName }); } catch {}
      }
      const idToken = await cred.user.getIdToken();
      await fetch('/api/auth/session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idToken }) });
      router.replace('/onboarding');
    } catch (error) {
      console.error('Sign-up failed', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // Email link handler removed

  const signOut = async () => {
    if (auth) { // Check if auth is initialized
      await auth.signOut();
      await fetch('/api/auth/session', { method: 'DELETE' });
      router.push('/signin');
    }
  };

  const getIdToken = async () => {
    return auth?.currentUser ? auth.currentUser.getIdToken() : null;
  };

  // No email link handler

  return (
    <AuthContext.Provider value={{
      user: user ? { id: user.uid, email: user.email || '', displayName: user.displayName || '' } : null,
      status: loading ? 'loading' : user ? 'authenticated' : 'unauthenticated',
      signIn,
      signUp,
      signOut,
      getIdToken,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = useCoreAuth;