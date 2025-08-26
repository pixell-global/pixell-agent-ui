## Auth Flows Implementation Checklist

### Branch & scope
- [x] Feature branch created and checked out

### Env & config
- [ ] `.env` populated with `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`, `SESSION_MAX_AGE_DAYS`
- [ ] Next.js API routes configured for Node runtime for auth endpoints

### Packages
- [ ] `auth-core` created with `AuthProvider`, `useAuth()`, and types
- [ ] `auth-firebase` created with client email-link helpers
- [ ] `auth-firebase` server helpers for session cookies (create/verify/revoke)

### API routes (apps/web)
- [ ] `POST /api/auth/session` – exchange ID token → HttpOnly cookie
- [ ] `DELETE /api/auth/session` – clear/revoke cookie

### Client flows
- [ ] Sign up page: email input, triggers email-link, completes cookie exchange
- [ ] Sign in page: email input, detects link, completes cookie exchange
- [ ] Sign out page/button: deletes session and signs out client
- [ ] `AuthProvider` context wired across app

### Middleware
- [ ] Protected route guard verifying session cookie
- [ ] Redirect unauthenticated users to `/signin`

### Telemetry & security
- [ ] Log sign-in success/failure, session create/delete
- [ ] Cookies: HttpOnly, Secure, SameSite=Lax, Path=/, correct Max-Age

### QA
- [ ] Sign up end-to-end creates session and redirects
- [ ] Sign in end-to-end accesses a protected page
- [ ] Sign out blocks access to protected pages


