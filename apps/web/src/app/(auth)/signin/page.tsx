import { Metadata } from 'next'
import { SignIn } from '@/components/auth/SignIn'

export const metadata: Metadata = {
  title: 'Sign In - Pixell Agent Framework',
  description: 'Sign in to your Pixell Agent workspace',
  robots: 'noindex',
}

export default function SignInPage() {
  return <SignIn />
}