'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from './AuthProvider';
import { Shield } from 'lucide-react';
import Link from 'next/link';
import { useToast } from '@/components/ui/toast-provider';

export const SignIn: React.FC = () => {
  const { signIn, status } = useAuth();
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
      const code = err?.code || err?.message || ''
      if (typeof code === 'string' && code.includes('auth/invalid-credential')) {
        const msg = 'Invalid email or password. Please try again.'
        setError(msg);
        addToast({ type: 'error', title: 'Sign-in failed', description: msg });
      } else if (typeof code === 'string' && code.includes('auth/too-many-requests')) {
        const msg = 'Too many attempts. Please wait and try again later.'
        setError(msg);
        addToast({ type: 'error', title: 'Sign-in blocked', description: msg });
      } else if (typeof code === 'string' && code.includes('auth/network-request-failed')) {
        const msg = 'Network error. Check your connection and try again.'
        setError(msg);
        addToast({ type: 'error', title: 'Network error', description: msg });
      } else {
        const msg = 'Sign-in failed. Please verify your credentials and try again.'
        setError(msg);
        addToast({ type: 'error', title: 'Sign-in failed', description: String(err?.message || msg) });
      }
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 flex items-center justify-center rounded-xl bg-blue-600">
            <Shield className="h-6 w-6 text-white" />
          </div>
          <h2 className="mt-6 text-3xl font-bold text-gray-900">Sign in to your account</h2>
          <p className="mt-2 text-sm text-gray-600">Access your Pixell Agent workspace</p>
        </div>

        <Card className="shadow-lg">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl font-semibold text-center">Welcome back</CardTitle>
            <CardDescription className="text-center">Enter your email and password to sign in.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
                  {error}
                </div>
              )}
              <Input
                type="email"
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full"
              />
              <Input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full"
              />
              <Button type="submit" className="w-full" disabled={status === 'loading'}>
                {status === 'loading' ? 'Signing in...' : 'Sign in'}
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="text-center">
          <p className="text-sm text-gray-600">
            Don't have an account?{' '}
            <Link href="/signup" className="font-medium text-blue-600 hover:text-blue-500">
              Sign up here
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};
