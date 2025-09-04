import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Only these routes are public; everything else requires auth
const PUBLIC_ROUTES = ['/signin', '/signup'];

export async function middleware(req: NextRequest) {
  const sessionCookieName = process.env.SESSION_COOKIE_NAME || 'session';
  const sessionCookie = req.cookies.get(sessionCookieName)?.value;
  const { pathname } = req.nextUrl;

  const isPublic = PUBLIC_ROUTES.includes(pathname);

  // Edge-safe check: do not use Node APIs here. Treat presence of session cookie as authenticated.
  if (!sessionCookie) {
    // No session: gate non-public routes
    if (!isPublic) {
      return NextResponse.redirect(new URL('/signin', req.url));
    }
    return NextResponse.next();
  }

  // Has a session cookie: if visiting a public page, redirect to app root
  if (isPublic) {
    return NextResponse.redirect(new URL('/', req.url));
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
