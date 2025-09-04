'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from './AuthProvider';
import { Shield } from 'lucide-react';
import Link from 'next/link';
import { useToast } from '@/components/ui/toast-provider';
import { Eye, EyeOff } from 'lucide-react';
import { Label } from '@/components/ui/label';

export const SignUp: React.FC = () => {
  const { signUp, status } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { addToast } = useToast();
  const [name, setName] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [emailCheck, setEmailCheck] = useState<'idle' | 'checking' | 'duplicate' | 'ok'>('idle');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Client-side validations
    if (!name.trim()) {
      addToast({ type: 'error', title: 'Name required', description: 'Please enter your name.' });
      return;
    }
    if (password !== confirmPassword) {
      addToast({ type: 'error', title: 'Passwords do not match', description: 'Please re-enter matching passwords.' });
      return;
    }
    // Basic password policy hint (Firebase enforces server-side too)
    const hasUpper = /[A-Z]/.test(password);
    const hasLower = /[a-z]/.test(password);
    const hasNumber = /\d/.test(password);
    if (!(hasUpper && hasLower && hasNumber) || password.length < 8) {
      addToast({ type: 'error', title: 'Weak password', description: 'Use 8+ chars with upper, lower and a number.' });
      return;
    }
    try {
      await signUp(email, password, name.trim());
    } catch (err: any) {
      const code: string = err?.code || '';
      const rawMessage: string = err?.message || 'Sign-up failed';
      let title = 'Sign-up failed';
      let description = 'Please review the details and try again.';

      if (typeof code === 'string') {
        if (code.includes('auth/email-already-in-use')) {
          title = 'Email already in use';
          description = 'Try signing in or use a different email address.';
        } else if (code.includes('auth/invalid-email')) {
          title = 'Invalid email address';
          description = 'Please enter a valid email address.';
        } else if (
          code.includes('auth/weak-password') ||
          code.includes('auth/password-does-not-meet-requirements')
        ) {
          title = 'Password does not meet requirements';
          // Firebase may include human-readable password policy details in message
          description = rawMessage.replace(/^Firebase:\s*/i, '');
        } else if (code.includes('auth/network-request-failed')) {
          title = 'Network error';
          description = 'Check your connection and try again.';
        } else if (code.includes('auth/operation-not-allowed')) {
          title = 'Sign-up temporarily unavailable';
          description = 'Email/password sign-up is disabled for this project.';
        } else {
          description = rawMessage.replace(/^Firebase:\s*/i, '');
        }
      }

      addToast({ type: 'error', title, description });
    }
  };

  // Optional: email duplicate pre-check by asking Firebase for sign-in methods.
  const handleEmailBlur = async () => {
    try {
      setEmailCheck('checking');
      // Lazy import to avoid increasing initial bundle too much
      const { getAuth, fetchSignInMethodsForEmail } = await import('firebase/auth');
      const methods = await fetchSignInMethodsForEmail(getAuth(), email);
      setEmailCheck(methods.length > 0 ? 'duplicate' : 'ok');
    } catch {
      setEmailCheck('idle');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 flex items-center justify-center rounded-xl bg-blue-600">
            <Shield className="h-6 w-6 text-white" />
          </div>
          <h2 className="mt-6 text-3xl font-bold text-gray-900">Create your account</h2>
          <p className="mt-2 text-sm text-gray-600">Get started with Pixell Agent Framework</p>
        </div>

        <Card className="shadow-lg">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl font-semibold text-center">Welcome</CardTitle>
            <CardDescription className="text-center">Enter your name, email, and password to sign up.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Full name</Label>
                <Input
                  id="name"
                  type="text"
                  placeholder="Full name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="w-full"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email address</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="Email address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onBlur={handleEmailBlur}
                  required
                  className="w-full"
                />
                {emailCheck === 'duplicate' && (
                  <div className="text-xs text-red-600">This email is already registered. Try signing in.</div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="w-full pr-10"
                  />
                  <button
                    type="button"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute inset-y-0 right-0 px-3 flex items-center text-gray-500 hover:text-gray-700"
                    onClick={() => setShowPassword((v) => !v)}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm password</Label>
                <div className="relative">
                  <Input
                    id="confirmPassword"
                    type={showConfirm ? 'text' : 'password'}
                    placeholder="Confirm password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    className="w-full pr-10"
                  />
                  <button
                    type="button"
                    aria-label={showConfirm ? 'Hide confirm password' : 'Show confirm password'}
                    className="absolute inset-y-0 right-0 px-3 flex items-center text-gray-500 hover:text-gray-700"
                    onClick={() => setShowConfirm((v) => !v)}
                  >
                    {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                <div className="text-[11px] text-gray-500 text-right">Use 8+ chars with upper, lower and a number</div>
              </div>

              <Button type="submit" className="w-full" disabled={status === 'loading'}>
                {status === 'loading' ? 'Creating account...' : 'Sign up'}
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="text-center">
          <p className="text-sm text-gray-600">
            Already have an account?{' '}
            <Link href="/signin" className="font-medium text-blue-600 hover:text-blue-500">
              Sign in here
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};
