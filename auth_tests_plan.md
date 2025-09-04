## Tests Plan – pxui-auth sign in / sign up / sign out

### Unit Tests
1. `auth-firebase` server helpers
   - `createSessionCookie` produces cookie with correct attributes and TTL
   - `verifySessionCookie` validates and returns expected claims
   - `revokeSessionCookie` triggers revocation without leaking errors
2. `auth-firebase` client helpers
   - `isSignInWithEmailLink(url)` truth table on typical and edge URLs
   - `completeSignInFromLink(url)` returns ID token (mock Firebase SDK)
3. `auth-core`
   - `AuthProvider` state transitions: idle → loading → authenticated → signout

### Integration Tests (Next.js API routes)
Environment: Node runtime with mocked Firebase Admin and cookie headers.
1. `POST /api/auth/session`
   - 200 on valid `idToken`, sets HttpOnly, Secure, SameSite=Lax cookie
   - 401 on invalid token
2. `DELETE /api/auth/session`
   - 200 and sets expired cookie

### Middleware Tests
- Protected route with valid cookie passes through
- Missing/invalid cookie redirects to `/signin`

### E2E Tests (Playwright)
Prereq: Mock Firebase email-link delivery or intercept deep link.
1. Sign up flow
   - Enter email → submit → open magic link → session cookie present → redirected
2. Sign in flow
   - Enter email → submit → open magic link → access protected page
3. Sign out flow
   - Click sign out → cookie cleared → protected page redirects

### Test Utilities
- Mock Firebase Web SDK and Admin SDK adapters
- Helper to parse `Set-Cookie` headers and assert flags and TTL


