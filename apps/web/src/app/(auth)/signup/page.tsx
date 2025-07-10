import { Metadata } from 'next'
import { SignUp } from '@/components/auth/SignUp'

export const metadata: Metadata = {
  title: 'Sign Up - Pixell Agent Framework',
  description: 'Create your Pixell Agent account',
  robots: 'noindex',
}

export default function SignUpPage() {
  return <SignUp />
}