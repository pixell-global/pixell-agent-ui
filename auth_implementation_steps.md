## Implementation Steps – pxui-auth sign in / sign up / sign out

Scope: Implement user-facing flows and minimal server routes to support Firebase email-link auth with HttpOnly session cookies as outlined in `docs/auth_refactor_prd.md`.

### 0) Prerequisites
- Configure Firebase project and obtain Admin credentials: `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` (PEM), `SESSION_MAX_AGE_DAYS`.
- Ensure Next.js API routes run on Node runtime where session cookies can be created.

### 1) Package scaffolding (minimal for flows)
1. Create `packages/auth-core` with provider-agnostic interfaces and hooks:
   - `AuthProvider`, `useAuth()` → `{ user, status, signIn(email), signOut(), getIdToken() }`
   - Types: `AuthUser`, `Session`
2. Create `packages/auth-firebase` with client helpers and server helpers:
   - Client: `signInWithEmailLink(email)`, `isSignInWithEmailLink(url)`, `completeSignInFromLink(url)`
   - Server: `createSessionCookie(idToken, expiresIn)`, `verifySessionCookie(cookieHeader)`, `revokeSessionCookie(cookie)`

Note: For this milestone, wire minimal exports required by the reference app. Detailed repo/DB work is out of scope for this step doc and will be handled in subsequent milestones.

### 2) Session cookie exchange routes
In `apps/web` create API routes (Node runtime):
1. `POST /api/auth/session` – body: `{ idToken }`
   - Verify ID token with Firebase Admin
   - Create HttpOnly + Secure session cookie with configured max age
   - Set cookie header and return `{ ok: true }`
2. `DELETE /api/auth/session` –
   - Clear the session cookie (set expired)
   - Optionally revoke cookie in Firebase Admin
   - Return `{ ok: true }`

Cookie settings: `HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/`, `Max-Age` per `SESSION_MAX_AGE_DAYS`.

### 3) Client auth context and hooks
1. Implement `AuthProvider` that tracks `user` state from Firebase client SDK and exposes:
   - `signIn(email)`: triggers email-link flow
   - `completeSignInFromLink(url)`: on landing, exchanges ID token → session cookie via `POST /api/auth/session`
   - `signOut()`: calls `DELETE /api/auth/session` and Firebase signOut
   - `getIdToken()`: retrieves fresh ID token if needed
2. Persist minimal UI state: `status: 'idle'|'loading'|'authenticated'|'error'`.

### 4) Pages (reference app)
1. `app/(auth)/signup/page.tsx` – email input form
   - On submit: call `signIn(email)` (same email-link flow); after cookie creation, redirect to org bootstrap page or surface org creation UI.
2. `app/(auth)/signin/page.tsx` – email input form
   - On submit: call `signIn(email)`.
   - On mount: if `isSignInWithEmailLink(url)`, call `completeSignInFromLink(url)` → sets cookie → redirect to app home.
3. `app/(auth)/signout/page.tsx` –
   - On mount/button: call `signOut()` then redirect to `/`.

### 5) Middleware guard
Implement middleware to verify session cookie for protected routes (e.g., `/team`, `/settings`, `/dashboard`). On missing/invalid session, redirect to `/signin`.

### 6) ENV wiring
- Add `.env.example` entries in `apps/web` for Firebase and session configuration.
- Ensure Node runtime for auth API routes.

### 7) Telemetry hooks (minimal)
- Log structured events for sign-in success/failure and session creation/deletion.

### 8) Manual QA checklist (for this milestone)
- Sign up with email link creates a session cookie and redirects appropriately.
- Sign in with email link creates a session cookie and allows access to a protected page.
- Sign out clears cookie and access to protected pages is blocked.


