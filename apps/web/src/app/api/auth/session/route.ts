import { NextResponse, NextRequest } from 'next/server';
import { createSessionCookie, revokeSessionCookie, verifySessionCookie } from '@pixell/auth-firebase/server';
import { getCredentialDebug } from '@pixell/auth-firebase/server';
import { getDb, users } from '@pixell/db-mysql';
import { eq } from 'drizzle-orm';

export async function POST(request: NextRequest) {
  const { idToken } = await request.json();

  if (!idToken) {
    return NextResponse.json({ error: 'idToken is required' }, { status: 400 });
  }

  try {
    // Helpful development-time diagnostic: check for project mismatch between client and server
    if (process.env.NODE_ENV !== 'production') {
      try {
        const payloadRaw = idToken.split('.')[1];
        const payloadJson = JSON.parse(Buffer.from(payloadRaw, 'base64').toString('utf8')) as any;
        const tokenAud = payloadJson?.aud as string | undefined;
        const tokenIssuer: string | undefined = payloadJson?.iss;
        const issuerProject = tokenIssuer?.startsWith('https://securetoken.google.com/')
          ? tokenIssuer.split('/').pop()
          : undefined;
        const clientProject = tokenAud || issuerProject;
        const adminProject = process.env.FIREBASE_PROJECT_ID;
        if (clientProject && adminProject && clientProject !== adminProject) {
          return NextResponse.json(
            { error: `Project mismatch: client(${clientProject}) != server(${adminProject}). Check Firebase envs.` },
            { status: 400 }
          );
        }
      } catch {}
    }
    const expiresIn = 60 * 60 * 24 * 5 * 1000; // 5 days
    const sessionCookie = await createSessionCookie(idToken, expiresIn);

    const isProd = process.env.NODE_ENV === 'production';
    const options = { httpOnly: true, secure: isProd, sameSite: 'lax' as const, maxAge: expiresIn, path: '/' };

    const response = NextResponse.json({ ok: true });
    const cookieName = process.env.SESSION_COOKIE_NAME || 'session';
    response.cookies.set(cookieName, sessionCookie, options);

    // Best-effort upsert of user row
    try {
      const decoded = await verifySessionCookie(sessionCookie);
      const uid = decoded.sub as string;
      const email = (decoded as any)?.email as string | undefined;
      const displayName = (decoded as any)?.name as string | undefined;
      const db = await getDb();
      const existing = await db.select().from(users).where(eq(users.id, uid)).limit(1);
      if (existing.length === 0) {
        await db.insert(users).values({ id: uid, email: email || uid, displayName: displayName || null });
      }
    } catch {}

    return response;
  } catch (error) {
    console.error('Error creating session cookie', error);
    const message = (error as any)?.message || 'Failed to create session';
    const cred = getCredentialDebug?.() as any;
    return NextResponse.json({ error: message, credential: cred }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const cookieName = process.env.SESSION_COOKIE_NAME || 'session';
  const sessionCookie = request.cookies.get(cookieName)?.value;

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
  response.cookies.set(cookieName, '', { expires: new Date(0), path: '/', sameSite: 'lax' });

  return response;
}
