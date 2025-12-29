'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from './AuthProvider';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/ui/toast-provider';
import { Eye, EyeOff } from 'lucide-react';

export const SignIn: React.FC = () => {
  const { signIn, status, user } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { addToast } = useToast();

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
    setError(null);
    setIsSubmitting(true);
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
    } finally {
      setIsSubmitting(false);
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
            Sign in to your account
          </h1>
          <p className="mt-2 text-sm text-white/60">
            Access your Pixell Agent workspace
          </p>
        </div>

        {/* Sign In Card */}
        <div className="glass-card p-8 space-y-6">
          <div className="text-center space-y-1">
            <h2 className="text-xl font-semibold text-white font-poppins">Welcome back</h2>
            <p className="text-sm text-white/50">Enter your email and password to sign in</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email" className="text-white/70">Email address</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-pixell-yellow/50 focus:ring-pixell-yellow/20"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-white/70">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter your password"
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

            <Button
              type="submit"
              className="w-full bg-pixell-yellow text-pixell-black hover:bg-pixell-yellow/90 font-medium"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Signing in...' : 'Sign in'}
            </Button>
          </form>
        </div>

        {/* Sign Up Link */}
        <div className="text-center">
          <p className="text-sm text-white/50">
            Don't have an account?{' '}
            <Link href="/signup" className="font-medium text-pixell-yellow hover:text-pixell-yellow/80 transition-colors">
              Sign up here
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};
