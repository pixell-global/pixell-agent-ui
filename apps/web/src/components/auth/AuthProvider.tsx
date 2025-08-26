'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { getAuth, onAuthStateChanged, User, Auth } from 'firebase/auth';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { firebaseConfig } from '@/lib/firebase';
import { AuthContext, useAuth as useCoreAuth } from '@pixell/auth-core';
import { 
  sendSignInLink as firebaseSignIn, 
  isSignInLink, 
  completeSignIn 
} from '@pixell/auth-firebase/client';



export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [auth, setAuth] = useState<Auth | null>(null); // Use useState for auth

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

  const signIn = async (email: string) => {
    const actionCodeSettings = {
      url: window.location.href, // URL to redirect back to
      handleCodeInApp: true,
    };
    if (auth) { // Check if auth is initialized
      await firebaseSignIn(email, actionCodeSettings);
      window.localStorage.setItem('emailForSignIn', email);
    }
  };

  const handleSignInLink = async (url: string) => {
    if (isSignInLink(url)) {
      const idToken = await completeSignIn(url);
      if (idToken) {
        await fetch('/api/auth/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ idToken }),
        });
        // router.push('/'); you might want to redirect here
      }
    }
  };

  const signOut = async () => {
    if (auth) { // Check if auth is initialized
      await auth.signOut();
      await fetch('/api/auth/session', { method: 'DELETE' });
    }
  };

  const getIdToken = async () => {
    return auth?.currentUser ? auth.currentUser.getIdToken() : null;
  };

  useEffect(() => {
    handleSignInLink(window.location.href);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user: user ? { id: user.uid, email: user.email || '', displayName: user.displayName || '' } : null,
        status: loading ? 'loading' : user ? 'authenticated' : 'unauthenticated',
        signIn,
        signOut,
        getIdToken,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = useCoreAuth;