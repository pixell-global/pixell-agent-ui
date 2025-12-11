import React, { createContext, useContext, useState, ReactNode } from 'react';
import { AuthUser } from './types';

type AuthStatus = 'idle' | 'loading' | 'authenticated' | 'unauthenticated' | 'error';

interface AuthContextType {
  user: AuthUser | null;
  status: AuthStatus;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, displayName?: string) => Promise<void>;
  signOut: () => Promise<void>;
  getIdToken: () => Promise<string | null>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [status, setStatus] = useState<AuthStatus>('idle');

  const signIn = async (email: string, password: string) => {
    // To be implemented by the provider
    console.log('signIn', email);
    setStatus('loading');
  };

  const signUp = async (email: string, password: string, displayName?: string) => {
    // To be implemented by the provider
    console.log('signUp', email);
    setStatus('loading');
  };

  const signOut = async () => {
    // To be implemented by the provider
    console.log('signOut');
    setUser(null);
    setStatus('unauthenticated');
  };

  const getIdToken = async () => {
    // To be implemented by the provider
    return null;
  };

  const value = { user, status, signIn, signUp, signOut, getIdToken };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
