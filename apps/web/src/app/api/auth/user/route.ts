import { NextRequest, NextResponse } from 'next/server';
import { verifySessionCookie } from '@pixell/auth-firebase/server';
import { getAuth } from 'firebase-admin/auth';

export async function GET(request: NextRequest) {
  try {
    const cookieName = process.env.SESSION_COOKIE_NAME || 'session';
    const sessionCookie = request.cookies.get(cookieName)?.value;

    if (!sessionCookie) {
      return NextResponse.json({ user: null }, { status: 200 });
    }

    const decoded = await verifySessionCookie(sessionCookie);
    const userRecord = await getAuth().getUser(decoded.sub);

    return NextResponse.json({
      user: {
        id: userRecord.uid,
        email: userRecord.email,
        displayName: userRecord.displayName || undefined,
      },
    });
  } catch (error) {
    console.error('Session verification error:', error);

    // If the session cookie is expired or invalid, clear it
    const response = NextResponse.json({ user: null }, { status: 200 });
    const cookieName = process.env.SESSION_COOKIE_NAME || 'session';

    // Clear the invalid cookie by setting it to expire in the past
    response.cookies.set(cookieName, '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      expires: new Date(0),
      path: '/'
    });

    return response;
  }
}


