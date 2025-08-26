import { NextResponse, NextRequest } from 'next/server';
import { createSessionCookie, revokeSessionCookie } from '@pixell/auth-firebase/server';

export async function POST(request: NextRequest) {
  const { idToken } = await request.json();

  if (!idToken) {
    return NextResponse.json({ error: 'idToken is required' }, { status: 400 });
  }

  try {
    const expiresIn = 60 * 60 * 24 * 5 * 1000; // 5 days
    const sessionCookie = await createSessionCookie(idToken, expiresIn);

    const options = { httpOnly: true, secure: true, maxAge: expiresIn, path: '/' };

    const response = NextResponse.json({ ok: true });
    response.cookies.set('session', sessionCookie, options);

    return response;
  } catch (error) {
    console.error('Error creating session cookie', error);
    return NextResponse.json({ error: 'Failed to create session' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const sessionCookie = request.cookies.get('session')?.value;

  if (!sessionCookie) {
    return NextResponse.json({ ok: true });
  }

  try {
    await revokeSessionCookie(sessionCookie);
  } catch (error) {
    console.error('Error revoking session cookie', error);
    // Ignore error and clear cookie anyway
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set('session', '', { expires: new Date(0), path: '/' });

  return response;
}
