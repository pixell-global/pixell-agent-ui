import { NextRequest, NextResponse } from 'next/server';
import { createSessionCookie, verifySessionCookie } from '@pixell/auth-firebase/server';
import { getDb, users } from '@pixell/db-mysql';
import { eq } from 'drizzle-orm';

export async function POST(request: NextRequest) {
  try {
    const { email, password, displayName } = await request.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password required' }, { status: 400 });
    }

    const apiKey = process.env.FIREBASE_WEB_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'Server auth not configured (missing FIREBASE_WEB_API_KEY)' }, { status: 500 });
    }

    const signUpRes = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, displayName, returnSecureToken: true }),
      }
    );

    const signUpJson = (await signUpRes.json()) as any;
    if (!signUpRes.ok) {
      const code = signUpJson?.error?.message || 'SIGN_UP_FAILED';
      const mapped =
        code.includes('EMAIL_EXISTS')
          ? 'Email already exists'
          : code.includes('WEAK_PASSWORD')
            ? 'Password is too weak'
            : 'Sign-up failed';
      const status = code.includes('EMAIL_EXISTS') ? 409 : 400;
      return NextResponse.json({ error: mapped, code }, { status });
    }

    const idToken = signUpJson.idToken as string;
    const expiresIn = 60 * 60 * 24 * 5 * 1000; // 5 days
    const sessionCookie = await createSessionCookie(idToken, expiresIn);

    const isProd = process.env.NODE_ENV === 'production';
    const response = NextResponse.json({
      success: true,
      user: {
        id: signUpJson.localId as string,
        email: signUpJson.email as string,
        displayName: (displayName as string | undefined) || undefined,
      },
    });

    const cookieName = process.env.SESSION_COOKIE_NAME || 'session';
    response.cookies.set(cookieName, sessionCookie, {
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax',
      maxAge: expiresIn,
      path: '/',
    });

    // Best-effort user upsert
    try {
      const decoded = await verifySessionCookie(sessionCookie);
      const uid = decoded.sub as string;
      const emailFromToken = (decoded as any)?.email as string | undefined;
      const displayNameFromToken = (decoded as any)?.name as string | undefined;
      const db = await getDb();
      const existing = await db.select().from(users).where(eq(users.id, uid)).limit(1);
      if (existing.length === 0) {
        await db.insert(users).values({ id: uid, email: emailFromToken || uid, displayName: displayNameFromToken || null });
      }
    } catch {}

    return response;
  } catch (error: any) {
    console.error('Sign-up error:', error);
    return NextResponse.json({ error: 'Sign-up failed' }, { status: 500 });
  }
}


