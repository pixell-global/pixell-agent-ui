import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Routes that don't require authentication
const PUBLIC_ROUTES = ['/signin', '/signup'];

// Routes that require auth but not subscription (onboarding flow)
const AUTH_ONLY_ROUTES = ['/billing'];

export async function middleware(req: NextRequest) {
  const sessionCookieName = process.env.SESSION_COOKIE_NAME || 'session';
  const sessionCookie = req.cookies.get(sessionCookieName)?.value;
  const { pathname } = req.nextUrl;

  const isPublic = PUBLIC_ROUTES.includes(pathname);
  const isAuthOnly = AUTH_ONLY_ROUTES.includes(pathname);

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

  // Has a session cookie: check if user has selected a billing plan
  // Skip subscription check for billing page and other auth-only routes
  if (!isAuthOnly) {
    const hasSubscription = await checkUserSubscription(req, sessionCookie);

    if (!hasSubscription) {
      // Redirect to billing page to select a plan
      const url = new URL('/billing', req.url);
      // Remember where they were trying to go
      if (pathname !== '/') {
        url.searchParams.set('returnTo', pathname);
      }
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

/**
 * Check if user has a subscription
 * This is a lightweight check - just verifies the subscription exists
 */
async function checkUserSubscription(req: NextRequest, sessionCookie: string): Promise<boolean> {
  try {
    const baseUrl = req.nextUrl.origin;
    const cookieName = process.env.SESSION_COOKIE_NAME || 'session';

    // Call internal API to check subscription
    const response = await fetch(`${baseUrl}/api/billing/subscription`, {
      headers: {
        Cookie: `${cookieName}=${sessionCookie}`,
      },
      cache: 'no-store', // Don't cache subscription checks
    });

    if (!response.ok) {
      // 404 = no subscription found
      if (response.status === 404) {
        return false;
      }
      // Other errors (401, 500, etc) - fail open to avoid blocking users
      console.error('[Middleware] Error checking subscription:', response.status);
      return true;
    }

    const data = await response.json();
    return !!(data.success && data.subscription);
  } catch (error) {
    console.error('[Middleware] Error fetching subscription:', error);
    // On error, assume they have subscription (fail open to avoid blocking users)
    return true;
  }
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
