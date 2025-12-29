'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from './AuthProvider';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/ui/toast-provider';
import { Eye, EyeOff } from 'lucide-react';
import { Label } from '@/components/ui/label';

export const SignUp: React.FC = () => {
  const { signUp, status, user } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { addToast } = useToast();
  const [name, setName] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [emailCheck, setEmailCheck] = useState<'idle' | 'checking' | 'duplicate' | 'ok'>('idle');

  // Redirect to home if already signed in
  useEffect(() => {
    if (status === 'authenticated' && user) {
      router.replace('/');
    }
  }, [status, user, router]);

  // Show loading while checking auth status or redirecting
  if (status === 'loading' || (status === 'authenticated' && user)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-pixell-black">
        <div className="text-white/60">Loading...</div>
      </div>
    );
  }

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
    setIsSubmitting(true);
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
    } finally {
      setIsSubmitting(false);
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
    <div className="min-h-screen flex items-center justify-center bg-pixell-black py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        {/* Logo and Header */}
        <div className="text-center">
          <img
            src="/assets/TypeLogo_Pixell_white.svg"
            alt="Pixell"
            className="mx-auto h-10"
          />
          <h1 className="mt-8 text-3xl font-bold text-white font-poppins">
            Create your account
          </h1>
          <p className="mt-2 text-sm text-white/60">
            Get started with Pixell Agent Framework
          </p>
        </div>

        {/* Sign Up Card */}
        <div className="glass-card p-8 space-y-6">
          <div className="text-center space-y-1">
            <h2 className="text-xl font-semibold text-white font-poppins">Welcome</h2>
            <p className="text-sm text-white/50">Enter your details to create an account</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-white/70">Full name</Label>
              <Input
                id="name"
                type="text"
                placeholder="John Doe"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-pixell-yellow/50 focus:ring-pixell-yellow/20"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email" className="text-white/70">Email address</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onBlur={handleEmailBlur}
                required
                className="w-full bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-pixell-yellow/50 focus:ring-pixell-yellow/20"
              />
              {emailCheck === 'duplicate' && (
                <p className="text-xs text-red-400">This email is already registered. Try signing in.</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-white/70">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Create a password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full pr-10 bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-pixell-yellow/50 focus:ring-pixell-yellow/20"
                />
                <button
                  type="button"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute inset-y-0 right-0 px-3 flex items-center text-white/40 hover:text-white/70 transition-colors"
                  onClick={() => setShowPassword((v) => !v)}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="text-white/70">Confirm password</Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirm ? 'text' : 'password'}
                  placeholder="Confirm your password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  className="w-full pr-10 bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-pixell-yellow/50 focus:ring-pixell-yellow/20"
                />
                <button
                  type="button"
                  aria-label={showConfirm ? 'Hide confirm password' : 'Show confirm password'}
                  className="absolute inset-y-0 right-0 px-3 flex items-center text-white/40 hover:text-white/70 transition-colors"
                  onClick={() => setShowConfirm((v) => !v)}
                >
                  {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              <p className="text-[11px] text-white/40 text-right">Use 8+ chars with upper, lower and a number</p>
            </div>

            <Button
              type="submit"
              className="w-full bg-pixell-yellow text-pixell-black hover:bg-pixell-yellow/90 font-medium"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Creating account...' : 'Sign up'}
            </Button>
          </form>
        </div>

        {/* Sign In Link */}
        <div className="text-center">
          <p className="text-sm text-white/50">
            Already have an account?{' '}
            <Link href="/signin" className="font-medium text-pixell-yellow hover:text-pixell-yellow/80 transition-colors">
              Sign in here
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};
