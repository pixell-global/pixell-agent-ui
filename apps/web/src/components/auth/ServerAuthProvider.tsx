'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useRouter } from 'next/navigation';

type User = {
  id: string;
  email: string;
  displayName?: string;
};

type ServerAuthContextType = {
  user: User | null;
  status: 'loading' | 'authenticated' | 'unauthenticated';
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, displayName?: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const ServerAuthContext = createContext<ServerAuthContextType | null>(null);

export const ServerAuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    void checkUserSession();

    // Set up periodic session checks (every 5 minutes)
    const interval = setInterval(() => {
      void checkUserSession();
    }, 5 * 60 * 1000);

    // Check session when tab becomes visible again
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        void checkUserSession();
      }
    };

    const handleFocus = () => {
      void checkUserSession();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  const checkUserSession = async () => {
    try {
      const response = await fetch('/api/auth/user', { credentials: 'include' });
      const data = await response.json();

      if (data.user) {
        setUser(data.user);
      } else {
        // No user returned - session may be expired or invalid
        setUser(null);

        // Clear any lingering cookies and redirect to signin if not already there
        if (window.location.pathname !== '/signin' && window.location.pathname !== '/signup') {
          // Clear session-related cookies
          const cookiesToClear = ['session', 'auth-token', '__session', 'firebase-auth-token']
          cookiesToClear.forEach(cookieName => {
            document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`
          })

          window.location.href = '/signin'
          return
        }
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to check user session:', error);
      setUser(null);

      // If we're getting network errors and not on auth pages, redirect to signin
      if (window.location.pathname !== '/signin' && window.location.pathname !== '/signup') {
        window.location.href = '/signin'
        return
      }
    } finally {
      setLoading(false);
    }
  };

  const signIn = async (email: string, password: string) => {
    setLoading(true);
    try {
      const response = await fetch('/api/auth/signin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Sign-in failed');
      }
      setUser(data.user as User);
      
      // Use window.location.href for a full page reload to ensure cookies are properly set
      // This ensures the server-side middleware and page components see the new session
      window.location.href = '/';
    } finally {
      setLoading(false);
    }
  };

  const signUp = async (email: string, password: string, displayName?: string) => {
    setLoading(true);
    try {
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password, displayName }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Sign-up failed');
      }
      setUser(data.user as User);
      
      // Use window.location.href for a full page reload to ensure cookies are properly set
      window.location.href = '/onboarding';
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    try {
      await fetch('/api/auth/session', { method: 'DELETE', credentials: 'include' });
    } catch {}
    setUser(null);
    // Use window.location.href for a full page reload to ensure cookies are properly cleared
    // This ensures the server-side middleware sees the cleared session
    window.location.href = '/signin';
  };

  return (
    <ServerAuthContext.Provider
      value={{
        user,
        status: loading ? 'loading' : user ? 'authenticated' : 'unauthenticated',
        signIn,
        signUp,
        signOut,
      }}
    >
      {children}
    </ServerAuthContext.Provider>
  );
};

export const useServerAuth = () => {
  const context = useContext(ServerAuthContext);
  if (!context) {
    throw new Error('useServerAuth must be used within ServerAuthProvider');
  }
  return context;
};


