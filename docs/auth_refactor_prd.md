# PRD – pxui-auth (Open Source) & pixell-enterprise (Commercial)

**Owner:** Pixell Global 
**Last updated:** 2025‑08‑25 (KST)
**Audience:** Engineering, Design, DevRel, Ops, Finance
**Status:** Draft → Implementation-ready

---

## 0) Goals & Non‑Goals

### Goals

* Provide a provider‑agnostic auth + org scaffold for all PAF apps.
* Use **Firebase Auth (email-link)** with secure **session cookies**; no “login” wording (use **Sign in / Sign up / Sign out**).
* First‑class **Organizations**, **Team & Roles**, **Invites**, and **Usage metering** for billing.
* Clean **open‑core vs enterprise** boundary: OSS includes scaffolding; enterprise adds billing, quotas, audit & advanced IAM.

### Non‑Goals (OSS)

* No payments (Stripe) in OSS.
* No granular policy engine or SAML/SCIM in OSS.

---

# Part A — **pxui-auth** (Open Source)

A provider‑agnostic authentication & org module for Next.js apps built on PAF. Includes `auth-core` interfaces, `auth-firebase` reference implementation, `db-mysql` repositories, pages for **Sign in/Sign up/Sign out**, **Invites**, **Team**, and **Usage tracking** primitives.

### 1) Repo Layout (public, inside `pixell-agent-ui`)

```
packages/
  auth-core/            # Provider-agnostic interfaces + React hooks
  auth-firebase/        # Firebase client + Admin helpers + session cookie exchange
  db-mysql/             # Drizzle/Prisma repos, migrations, tenancy guards
  usage/                # client + server helpers for action metering
apps/web/               # Reference app: signin/signup/signout, team, invites
```

### 2) User Stories

1. As a user, I can **Sign up** with email link and immediately create an **Organization** where I am **Owner**.
2. As an Org Owner/Admin, I can **invite** teammates by email, assign a role, and they can **accept** after **Sign in**.
3. As a member, I can view **Team** and roles; Owners can change roles, remove members.
4. As any authenticated user, agent actions I trigger are recorded as **action events** for future billing.

### 3) UX Scope (reference app)

* **/signup** – email address → send email link. After first session, show **Create organization** form (name required).
* **/signin** – email address → send email link; consume link to create session.
* **/signout** – clear session, redirect home.
* **/team** – list members (name, email, role), invite form (email+role), revoke invite, remove/change role.
* **/accept-invite** – verifies token, enforces session, accepts into org.
* **/settings/organization** – rename org (Owner/Admin).

> Wording: strictly “Sign in / Sign up / Sign out.”

### 4) Architecture

* **Client Auth:** Firebase Web SDK (`signInWithEmailLink`), guarded by `auth-core` hooks.
* **Session:** Exchange ID token → **HttpOnly session cookie** via Firebase Admin on a **Node runtime** route.
* **Server Auth:** Middleware verifies session cookie → attaches `{ uid, email, orgId }`.
* **DB:** MySQL (RDS) as source of truth for users/orgs/invites/usage.
* **Tenancy:** All repo methods enforce `WHERE org_id = ?` and membership checks.

### 5) Data Model (MySQL 8)

```sql
create table users (
  id varchar(128) primary key,        -- firebase uid
  email varchar(320) not null unique,
  display_name varchar(120),
  created_at timestamp not null default current_timestamp
) engine=innodb;

create table organizations (
  id char(36) primary key,
  name varchar(160) not null,
  created_by varchar(128) not null,
  created_at timestamp not null default current_timestamp,
  foreign key (created_by) references users(id)
) engine=innodb;

create table organization_members (
  org_id char(36) not null,
  user_id varchar(128) not null,
  role enum('owner','admin','member','viewer') not null default 'owner',
  joined_at timestamp not null default current_timestamp,
  primary key (org_id, user_id),
  foreign key (org_id) references organizations(id) on delete cascade,
  foreign key (user_id) references users(id) on delete cascade
) engine=innodb;

create table org_invitations (
  id char(36) primary key,
  org_id char(36) not null,
  email varchar(320) not null,
  role enum('owner','admin','member','viewer') not null default 'member',
  token_hash char(64) not null unique,  -- sha256(secret + token)
  status enum('pending','accepted','expired','revoked') not null default 'pending',
  invited_by varchar(128) not null,
  created_at timestamp not null default current_timestamp,
  expires_at timestamp not null,
  foreign key (org_id) references organizations(id) on delete cascade,
  foreign key (invited_by) references users(id)
) engine=innodb;

create table action_events (
  id bigint unsigned auto_increment primary key,
  org_id char(36) not null,
  user_id varchar(128) not null,
  app_id varchar(80),
  action_key varchar(120) not null,      -- e.g. "reddit.comment.generate"
  units int not null default 1,
  idempotency_key varchar(120),          -- prevent double count
  metadata json,
  created_at timestamp not null default current_timestamp,
  index idx_usage_org_created (org_id, created_at),
  unique key uniq_usage_dedupe (org_id, idempotency_key),
  foreign key (org_id) references organizations(id) on delete cascade,
  foreign key (user_id) references users(id) on delete set null
) engine=innodb;
```

#### Derived Views (example)

```sql
create view monthly_usage as
select org_id,
       date_format(created_at,'%Y-%m-01') as month,
       sum(units) as units
from action_events
group by 1,2;
```

### 6) Packages & APIs

#### `packages/auth-core`

* **Exports**

  * `AuthProvider`, `useAuth()` → `{ user, status, signIn(email), signOut(), getIdToken() }`
  * `withAuth(handler, options)` → server helper to enforce session.
* **Types**

  * `AuthUser = { id: string; email: string; displayName?: string }`
  * `Session = { uid: string; email: string; orgId?: string }`

#### `packages/auth-firebase`

* **Client**

  * `signInWithEmailLink(email)` / `isSignInWithEmailLink(url)`
  * `completeSignInFromLink(url)` → retrieves ID token, POSTs to `/api/auth/session`.
* **Server**

  * `verifySessionCookie(cookieHeader) => Session | null`
  * `createSessionCookie(idToken, expiresIn)`
  * `revokeSessionCookie(cookie)`
* **Env**

  * `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` (PEM), `SESSION_MAX_AGE_DAYS`.

#### `packages/db-mysql`

* Implement with **Drizzle** or **Prisma**.
* Repos (server‑only):

  * `UsersRepo.upsertFromFirebase(uid, email, displayName?)`
  * `OrgsRepo.create(name, createdBy)` → returns `orgId`
  * `MembersRepo.add(orgId, userId, role)` / `MembersRepo.list(orgId)` / `MembersRepo.updateRole(...)` / `remove(...)`
  * `InvitesRepo.create({ orgId, email, role, tokenHash, invitedBy, expiresAt })` / `accept(tokenHash, userId)` / `revoke(id)`
  * `UsageRepo.track({ orgId, userId, actionKey, units, idempotencyKey, metadata })`
  * **All methods** validate membership from `(orgId, userId)`.

#### `packages/usage`

* **Client**: `track(actionKey, units=1, metadata?, idempotencyKey?)` → `POST /api/usage/track`.
* **Server**: Next.js route handler that validates session & membership, inserts to `action_events`.

### 7) Next.js Pages & Routes (reference app)

* `app/(auth)/signin/page.tsx` – email form → link
* `app/(auth)/signup/page.tsx` – email form; after session create org
* `app/(auth)/signout/page.tsx` – call DELETE session
* `app/(team)/team/page.tsx` – list members, invite modal
* `app/accept-invite/page.tsx` – token consumer

**API Routes** (Node runtime):

* `POST /api/auth/session` – exchange ID token → session cookie (HttpOnly)
* `DELETE /api/auth/session` – clear cookie
* `POST /api/bootstrap` – first‑sign: upsert user, create org, add owner
* `POST /api/invites/create` – create invite (Owner/Admin)
* `POST /api/invites/accept` – accept invite (requires session)
* `POST /api/invites/revoke` – revoke pending invite
* `POST /api/usage/track` – insert action event (with idempotency)

**Middleware**

* Route guard for `/team`, `/settings`, `/dashboard` → verify session; redirect `/signin` if missing.

### 8) Security & Compliance

* **Sessions:** HttpOnly, Secure, SameSite=Lax; 14‑day default; rotation on sign‑in.
* **Invite tokens:** random 32+ bytes; store only SHA‑256 hash + pepper; expire in 7 days.
* **Authorization:** server‑side checks: membership and role per org; never trust client.
* **Audit hooks:** emit server logs on invite create/accept/revoke, role changes. (Full audit moves to enterprise.)
* **PII:** store minimal (email, display name optional).

### 9) Telemetry

* OSS emits structured server logs (`info|warn|error`) for: sign‑in success/failure, invite create/accept, usage insert (with idempotency outcome).

### 10) Testing Strategy

* Unit: repos (mock DB), token verification, cookie creation.
* Integration: API routes with in‑memory MySQL (or Testcontainers).
* E2E: Playwright – signup → create org → invite → accept → team visible.

### 11) Documentation

* Setup Firebase project + Admin credentials; configure `.env`.
* MySQL schema migrations; seed scripts.
* Code samples for agent apps to `track()` actions.

### 12) Licensing

* `auth-core`, `auth-firebase`, `usage`, UI pages → **MIT**.
* `db-mysql` (server repos & migrations) → **AGPL‑3.0**.

### 13) Milestones

* **M0 (2 days):** packages skeletons + env wiring + session cookie route.
* **M1 (3 days):** DB migrations + bootstrap + invites + team UI.
* **M2 (2 days):** usage tracking + idempotency + docs + tests.

---
