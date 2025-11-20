# Firebase Server-Only Authentication Migration Guide

## Overview

This guide provides a comprehensive plan to migrate from Firebase client-side authentication to server-only authentication, eliminating the need for client-side environment variables and the associated deployment complexity.

## Current Architecture Analysis

### Current Client-Side Implementation
- **AuthProvider**: Uses Firebase client SDK (`firebase/auth`) for sign-in/sign-up
- **Client Components**: `SignIn.tsx`, `SignUp.tsx` use Firebase client methods
- **Environment Variables**: Requires `NEXT_PUBLIC_FIREBASE_*` variables in browser
- **Session Management**: Client gets ID token → sends to `/api/auth/session` → server creates session cookie
- **Route Protection**: Middleware checks for session cookie presence

### Current Server-Side Infrastructure
- **Session API**: `/api/auth/session` already handles ID token → session cookie conversion
- **Server Auth**: `@pixell/auth-firebase/server` package with Firebase Admin SDK
- **Middleware**: Already protects routes using session cookies
- **Database**: User management via `@pixell/db-mysql`

## Migration Strategy

### Phase 1: Create Server-Only Auth API Routes

#### 1.1 Create Sign-In API Route
```typescript
// apps/web/src/app/api/auth/signin/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { signInWithEmailAndPassword } from 'firebase-admin/auth';
import { createSessionCookie } from '@pixell/auth-firebase/server';

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();
    
    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password required' }, { status: 400 });
    }

    // Use Firebase Admin SDK for server-side authentication
    const userRecord = await signInWithEmailAndPassword(
      getAuth(), // Firebase Admin Auth instance
      email,
      password
    );

    // Create session cookie
    const expiresIn = 60 * 60 * 24 * 5 * 1000; // 5 days
    const sessionCookie = await createSessionCookie(userRecord.uid, expiresIn);

    const response = NextResponse.json({ 
      success: true, 
      user: {
        id: userRecord.uid,
        email: userRecord.email,
        displayName: userRecord.displayName
      }
    });

    // Set HttpOnly session cookie
    const cookieName = process.env.SESSION_COOKIE_NAME || 'session';
    response.cookies.set(cookieName, sessionCookie, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: expiresIn,
      path: '/'
    });

    return response;
  } catch (error: any) {
    console.error('Sign-in error:', error);
    
    // Map Firebase Admin errors to user-friendly messages
    if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }
    if (error.code === 'auth/too-many-requests') {
      return NextResponse.json({ error: 'Too many attempts. Please try again later' }, { status: 429 });
    }
    
    return NextResponse.json({ error: 'Sign-in failed' }, { status: 500 });
  }
}
```

#### 1.2 Create Sign-Up API Route
```typescript
// apps/web/src/app/api/auth/signup/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createUser } from 'firebase-admin/auth';
import { createSessionCookie } from '@pixell/auth-firebase/server';

export async function POST(request: NextRequest) {
  try {
    const { email, password, displayName } = await request.json();
    
    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password required' }, { status: 400 });
    }

    // Create user with Firebase Admin SDK
    const userRecord = await createUser({
      email,
      password,
      displayName: displayName || undefined
    });

    // Create session cookie
    const expiresIn = 60 * 60 * 24 * 5 * 1000; // 5 days
    const sessionCookie = await createSessionCookie(userRecord.uid, expiresIn);

    const response = NextResponse.json({ 
      success: true, 
      user: {
        id: userRecord.uid,
        email: userRecord.email,
        displayName: userRecord.displayName
      }
    });

    // Set HttpOnly session cookie
    const cookieName = process.env.SESSION_COOKIE_NAME || 'session';
    response.cookies.set(cookieName, sessionCookie, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: expiresIn,
      path: '/'
    });

    return response;
  } catch (error: any) {
    console.error('Sign-up error:', error);
    
    if (error.code === 'auth/email-already-exists') {
      return NextResponse.json({ error: 'Email already exists' }, { status: 409 });
    }
    if (error.code === 'auth/weak-password') {
      return NextResponse.json({ error: 'Password is too weak' }, { status: 400 });
    }
    
    return NextResponse.json({ error: 'Sign-up failed' }, { status: 500 });
  }
}
```

#### 1.3 Create User Session API Route
```typescript
// apps/web/src/app/api/auth/user/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { verifySessionCookie } from '@pixell/auth-firebase/server';
import { getAuth } from 'firebase-admin/auth';

export async function GET(request: NextRequest) {
  try {
    const cookieName = process.env.SESSION_COOKIE_NAME || 'session';
    const sessionCookie = request.cookies.get(cookieName)?.value;
    
    if (!sessionCookie) {
      return NextResponse.json({ user: null }, { status: 200 });
    }

    const decoded = await verifySessionCookie(sessionCookie);
    const userRecord = await getAuth().getUser(decoded.sub);

    return NextResponse.json({
      user: {
        id: userRecord.uid,
        email: userRecord.email,
        displayName: userRecord.displayName
      }
    });
  } catch (error) {
    console.error('Session verification error:', error);
    return NextResponse.json({ user: null }, { status: 200 });
  }
}
```

### Phase 2: Update Client Components

#### 2.1 Create New Server-Only Auth Provider
```typescript
// apps/web/src/components/auth/ServerAuthProvider.tsx
'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { AuthContext, useAuth as useCoreAuth } from '@pixell/auth-core';

interface User {
  id: string;
  email: string;
  displayName?: string;
}

interface ServerAuthContextType {
  user: User | null;
  status: 'loading' | 'authenticated' | 'unauthenticated';
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, displayName?: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const ServerAuthContext = createContext<ServerAuthContextType | null>(null);

export const ServerAuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  // Check user session on mount
  useEffect(() => {
    checkUserSession();
  }, []);

  const checkUserSession = async () => {
    try {
      const response = await fetch('/api/auth/user', { credentials: 'include' });
      const data = await response.json();
      setUser(data.user);
    } catch (error) {
      console.error('Failed to check user session:', error);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      setLoading(true);
      const response = await fetch('/api/auth/signin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Sign-in failed');
      }

      setUser(data.user);
      router.replace('/');
    } catch (error) {
      console.error('Sign-in failed:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const signUp = async (email: string, password: string, displayName?: string) => {
    try {
      setLoading(true);
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password, displayName })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Sign-up failed');
      }

      setUser(data.user);
      router.replace('/onboarding');
    } catch (error) {
      console.error('Sign-up failed:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    try {
      await fetch('/api/auth/session', { method: 'DELETE', credentials: 'include' });
      setUser(null);
      router.replace('/signin');
    } catch (error) {
      console.error('Sign-out failed:', error);
    }
  };

  return (
    <ServerAuthContext.Provider value={{
      user,
      status: loading ? 'loading' : user ? 'authenticated' : 'unauthenticated',
      signIn,
      signUp,
      signOut,
    }}>
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
```

#### 2.2 Update Sign-In Component
```typescript
// apps/web/src/components/auth/ServerSignIn.tsx
'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useServerAuth } from './ServerAuthProvider';
import { Shield } from 'lucide-react';
import Link from 'next/link';
import { useToast } from '@/components/ui/toast-provider';

export const ServerSignIn: React.FC = () => {
  const { signIn, status } = useServerAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const { addToast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await signIn(email, password);
    } catch (err: any) {
      const message = err?.message || 'Sign-in failed. Please try again.';
      setError(message);
      addToast({ type: 'error', title: 'Sign-in failed', description: message });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <div className="mx-auto h-12 w-12 flex items-center justify-center rounded-full bg-blue-100">
            <Shield className="h-6 w-6 text-blue-600" />
          </div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Sign in to your account
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Or{' '}
            <Link href="/signup" className="font-medium text-blue-600 hover:text-blue-500">
              create a new account
            </Link>
          </p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Welcome back</CardTitle>
            <CardDescription>Enter your credentials to access your workspace</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                  Email address
                </label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                  Password
                </label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-1"
                />
              </div>
              {error && (
                <div className="text-red-600 text-sm">{error}</div>
              )}
              <Button
                type="submit"
                className="w-full"
                disabled={status === 'loading'}
              >
                {status === 'loading' ? 'Signing in...' : 'Sign in'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
```

### Phase 3: Update Application Structure

#### 3.1 Update Root Layout
```typescript
// apps/web/src/app/layout.tsx
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import "katex/dist/katex.min.css";
import { ToastProvider } from "@/components/ui/toast-provider";
import { ToastDisplay } from "@/components/ui/toast-display";
import { ServerAuthProvider } from "@/components/auth/ServerAuthProvider";
// Remove Firebase client script import

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Pixell Agent Framework",
  description: "Advanced AI agent orchestration platform",
};

export const dynamic = 'force-dynamic';

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {/* Remove runtime-env.js script */}
        <ServerAuthProvider>
          <ToastProvider>
            <ToastDisplay />
            {children}
          </ToastProvider>
        </ServerAuthProvider>
      </body>
    </html>
  );
}
```

#### 3.2 Update Sign-In Page
```typescript
// apps/web/src/app/(auth)/signin/page.tsx
import { Metadata } from 'next'
import { ServerSignIn } from '@/components/auth/ServerSignIn'

export const metadata: Metadata = {
  title: 'Sign In - Pixell Agent Framework',
  description: 'Sign in to your Pixell Agent workspace',
  robots: 'noindex',
}

export default function SignInPage() {
  return <ServerSignIn />
}
```

#### 3.3 Update API Fetch Utility
```typescript
// apps/web/src/lib/utils.ts
import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Simplified API fetch wrapper - no Firebase client dependency
export async function apiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const res = await fetch(input, { ...init, credentials: 'include' });
  
  // If 401, redirect to signin (handled by middleware)
  if (res.status === 401) {
    window.location.href = '/signin';
    return res;
  }
  
  return res;
}
```

### Phase 4: Environment Variables Cleanup

#### 4.1 Remove Client-Side Firebase Variables
Remove these from all environment files:
- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`

#### 4.2 Keep Server-Side Firebase Variables
Keep these for Firebase Admin SDK:
- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY`
- `FIREBASE_CREDENTIALS_PATH` (alternative)
- `FIREBASE_CREDENTIALS_JSON` (alternative)

#### 4.3 Update Dockerfile
```dockerfile
# Remove Firebase client build args and runtime-env.js generation
# Keep only server-side Firebase Admin SDK configuration

# Remove these lines:
# ARG NEXT_PUBLIC_FIREBASE_API_KEY
# ARG NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
# ... (all NEXT_PUBLIC_FIREBASE_* args)

# Remove runtime-env.js generation from entrypoint.sh
```

#### 4.4 Update Entrypoint Script
```bash
#!/bin/sh
set -e

# Load environment variables from /app/.env if present
if [ -f /app/.env ]; then
  echo "[entrypoint] Loading /app/.env"
  # shellcheck disable=SC2046
  export $(grep -E '^[A-Za-z_][A-Za-z0-9_]*=' /app/.env | xargs)
fi

# No need for runtime-env.js generation
exec node apps/web/server.js
```

### Phase 5: Remove Firebase Client Dependencies

#### 5.1 Update Package.json
```json
{
  "dependencies": {
    // Remove these:
    // "firebase": "^10.12.2",
    
    // Keep these for server-side:
    // "firebase-admin": "^12.1.1"
  }
}
```

#### 5.2 Remove Firebase Client Files
- `apps/web/src/lib/firebase.ts` (client config)
- `apps/web/src/components/auth/AuthProvider.tsx` (old client provider)
- `apps/web/src/components/auth/SignIn.tsx` (old client signin)
- `apps/web/src/components/auth/SignUp.tsx` (old client signup)

### Phase 6: Testing and Validation

#### 6.1 Test Authentication Flow
1. **Sign Up**: Create new account via server API
2. **Sign In**: Authenticate existing user via server API
3. **Session Persistence**: Verify session cookie works across page refreshes
4. **Sign Out**: Clear session and redirect to signin
5. **Route Protection**: Verify middleware blocks unauthenticated access

#### 6.2 Test API Endpoints
1. **Protected Routes**: Verify all API routes require valid session
2. **User Context**: Verify user data is correctly retrieved from session
3. **Error Handling**: Test various error scenarios (invalid credentials, network issues)

#### 6.3 Performance Testing
1. **Bundle Size**: Verify reduced client bundle size (no Firebase client SDK)
2. **Load Time**: Measure improved initial page load times
3. **Memory Usage**: Check reduced client-side memory footprint

## Benefits of Server-Only Authentication

### 1. **Eliminates Client Environment Variables**
- No more `NEXT_PUBLIC_FIREBASE_*` variables needed
- No more runtime environment injection complexity
- No more build-time vs runtime environment variable issues

### 2. **Improved Security**
- All authentication logic runs on server
- No client-side Firebase configuration exposure
- HttpOnly session cookies prevent XSS attacks

### 3. **Simplified Deployment**
- No need for complex Docker build args
- No need for runtime-env.js generation
- Consistent behavior across environments

### 4. **Better Performance**
- Smaller client bundle (no Firebase client SDK)
- Faster initial page loads
- Reduced client-side JavaScript execution

### 5. **Easier Debugging**
- All auth logic centralized on server
- Clear error messages and logging
- No client-server configuration mismatches

## Migration Checklist

- [ ] Create server-side auth API routes (`/api/auth/signin`, `/api/auth/signup`, `/api/auth/user`)
- [ ] Create new `ServerAuthProvider` component
- [ ] Create new `ServerSignIn` and `ServerSignUp` components
- [ ] Update root layout to use `ServerAuthProvider`
- [ ] Update signin/signup pages to use new components
- [ ] Update `apiFetch` utility to remove Firebase client dependency
- [ ] Remove Firebase client environment variables from all env files
- [ ] Update Dockerfile to remove client Firebase build args
- [ ] Update entrypoint.sh to remove runtime-env.js generation
- [ ] Remove Firebase client dependencies from package.json
- [ ] Delete old Firebase client components and utilities
- [ ] Test complete authentication flow
- [ ] Test API endpoint protection
- [ ] Verify reduced bundle size and improved performance
- [ ] Update documentation and deployment guides

## Rollback Plan

If issues arise during migration:

1. **Keep old components**: Don't delete old Firebase client components until migration is fully tested
2. **Feature flags**: Use environment variables to switch between old and new auth systems
3. **Gradual rollout**: Migrate one component at a time
4. **Database compatibility**: Ensure user data remains compatible between systems

## Conclusion

This migration eliminates the complex client-side Firebase configuration issues while maintaining all authentication functionality. The server-only approach is more secure, performant, and easier to deploy and maintain.
