'use client'

import React, { useState } from 'react'
import { Auth } from '@supabase/auth-ui-react'
import { ThemeSupa } from '@supabase/auth-ui-shared'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { useAuth } from './AuthProvider'
import { Building2, Shield, Users } from 'lucide-react'
import Link from 'next/link'

interface SignInProps {
  redirectTo?: string
}

export const SignIn: React.FC<SignInProps> = ({ 
  redirectTo = process.env.NEXT_PUBLIC_AUTH_REDIRECT || '/dashboard' 
}) => {
  const { supabase } = useAuth()
  const [view, setView] = useState<'sign_in' | 'magic_link'>('sign_in')
  
  // Check if SSO is enabled
  const ssoEnabled = process.env.NEXT_PUBLIC_SSO_DOMAIN

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        {/* Header */}
        <div className="text-center">
          <div className="mx-auto h-12 w-12 flex items-center justify-center rounded-xl bg-blue-600">
            <Shield className="h-6 w-6 text-white" />
          </div>
          <h2 className="mt-6 text-3xl font-bold text-gray-900">
            Sign in to your account
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Access your Pixell Agent workspace
          </p>
        </div>

        {/* Auth Form */}
        <Card className="shadow-lg">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl font-semibold text-center">Welcome back</CardTitle>
            <CardDescription className="text-center">
              Enter your credentials to access your account
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* SSO Options */}
            {ssoEnabled && (
              <>
                <div className="space-y-3">
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => {
                      // Handle SSO sign in
                      supabase.auth.signInWithOAuth({
                        provider: 'azure',
                        options: {
                          scopes: 'email',
                          redirectTo: typeof window !== 'undefined' ? window.location.origin + redirectTo : redirectTo
                        }
                      })
                    }}
                  >
                    <Building2 className="mr-2 h-4 w-4" />
                    Continue with SSO
                  </Button>
                  
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => {
                      supabase.auth.signInWithOAuth({
                        provider: 'google',
                        options: {
                          redirectTo: typeof window !== 'undefined' ? window.location.origin + redirectTo : redirectTo
                        }
                      })
                    }}
                  >
                    <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                      <path
                        fill="currentColor"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="currentColor"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="currentColor"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                      />
                      <path
                        fill="currentColor"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                      />
                    </svg>
                    Continue with Google
                  </Button>
                </div>
                
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <Separator className="w-full" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-white px-2 text-muted-foreground">
                      Or continue with
                    </span>
                  </div>
                </div>
              </>
            )}

            {/* Supabase Auth UI */}
            <Auth
              supabaseClient={supabase}
              view={view}
              appearance={{
                theme: ThemeSupa,
                variables: {
                  default: {
                    colors: {
                      brand: '#2563eb',
                      brandAccent: '#1d4ed8',
                    },
                  },
                },
                className: {
                  container: 'auth-container',
                  button: 'auth-button',
                  input: 'auth-input',
                },
              }}
              providers={[]}
              redirectTo={typeof window !== 'undefined' ? window.location.origin + redirectTo : redirectTo}
              onlyThirdPartyProviders={false}
              magicLink={view === 'magic_link'}
              showLinks={false}
            />

            {/* Toggle between views */}
            <div className="text-center space-y-2">
              {view === 'sign_in' ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setView('magic_link')}
                  className="text-sm"
                >
                  Sign in with magic link instead
                </Button>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setView('sign_in')}
                  className="text-sm"
                >
                  Sign in with password instead
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Sign up link */}
        <div className="text-center">
          <p className="text-sm text-gray-600">
            Don't have an account?{' '}
            <Link
              href="/signup"
              className="font-medium text-blue-600 hover:text-blue-500"
            >
              Sign up here
            </Link>
          </p>
        </div>

        {/* Enterprise features */}
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2 text-blue-800">
              <Users className="h-4 w-4" />
              <span className="text-sm font-medium">Enterprise Ready</span>
            </div>
            <p className="text-xs text-blue-700 mt-1">
              SSO, MFA, and advanced security features available
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}