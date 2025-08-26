import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifySessionCookie } from '@pixell/auth-firebase/server';

const PROTECTED_ROUTES = ['/dashboard', '/team', '/settings']; // Add your protected routes here
const PUBLIC_ROUTES = ['/signin', '/signup', '/'];

export async function middleware(req: NextRequest) {
  const sessionCookie = req.cookies.get('session')?.value;
  const { pathname } = req.nextUrl;

  const isProtectedRoute = PROTECTED_ROUTES.some(route => pathname.startsWith(route));

  if (!sessionCookie && isProtectedRoute) {
    return NextResponse.redirect(new URL('/signin', req.url));
  }

  if (sessionCookie) {
    try {
      await verifySessionCookie(sessionCookie);
      // User is authenticated
      if (PUBLIC_ROUTES.includes(pathname)) {
        // Redirect to dashboard if user is on a public page like signin/signup
        // return NextResponse.redirect(new URL('/dashboard', req.url));
      }
    } catch (error) {
      // Session is invalid
      if (isProtectedRoute) {
        const response = NextResponse.redirect(new URL('/signin', req.url));
        response.cookies.set('session', '', { expires: new Date(0), path: '/' });
        return response;
      }
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
