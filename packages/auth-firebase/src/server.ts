import { initializeApp, getApps, App, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import fs from 'fs';
import path from 'path';

const isProd = process.env.NODE_ENV === 'production';

type CredentialDebug =
  | { source: 'env'; projectId: string; clientEmail: string }
  | { source: 'path'; projectId: string; clientEmail: string; provided: string; chosenPath: string; exists: boolean }
  | { source: 'json'; projectId: string; clientEmail: string }
  | { source: 'none' };

let lastCredentialDebug: CredentialDebug = { source: 'none' };
export const getCredentialDebug = () => lastCredentialDebug;

const getRepoRoots = (): string[] => {
  // Try to infer monorepo root and app cwd
  const roots = new Set<string>();
  roots.add(process.cwd());
  roots.add(path.resolve(process.cwd(), '..', '..'));
  // Fallback using this module location
  roots.add(path.resolve(__dirname, '..', '..', '..'));
  return Array.from(roots);
};

const findDefaultCredentialsJson = (): string | null => {
  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const candidates: string[] = [];
  const roots = getRepoRoots();
  for (const root of roots) {
    // Prefer explicit filename env
    const basename = process.env.FIREBASE_CREDENTIALS_BASENAME;
    if (basename) candidates.push(path.join(root, basename));
    // Common patterns
    if (projectId) candidates.push(path.join(root, `${projectId}-firebase-adminsdk.json`));
    if (projectId) candidates.push(path.join(root, `${projectId}-firebase-adminsdk-credentials.json`));
    if (projectId) candidates.push(path.join(root, `${projectId}-firebase-adminsdk-*.json`));
    candidates.push(path.join(root, 'serviceAccountKey.json'));
    candidates.push(path.join(root, 'firebase-adminsdk.json'));
  }

  for (const cand of candidates) {
    // Simple glob fallback: if pattern contains *, scan dir
    if (cand.includes('*')) {
      const dir = path.dirname(cand);
      const prefix = path.basename(cand).split('*')[0];
      try {
        const names = fs.readdirSync(dir);
        const match = names.find((n) => n.startsWith(prefix) && n.endsWith('.json'));
        if (match) return path.join(dir, match);
      } catch {}
      continue;
    }
    if (fs.existsSync(cand)) return cand;
  }

  return null;
};

const resolveServiceAccount = (): { projectId: string; clientEmail: string; privateKey: string } | null => {
  // 1) Env triplet
  const fromEnv = {
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  };
  if (fromEnv.projectId && fromEnv.clientEmail && fromEnv.privateKey) {
    if (!isProd) {
      // eslint-disable-next-line no-console
      console.log('[AuthFirebase] Using credentials from env triplet (FIREBASE_PROJECT_ID/CLIENT_EMAIL/PRIVATE_KEY).', {
        projectId: fromEnv.projectId,
        clientEmail: fromEnv.clientEmail,
      });
    }
    lastCredentialDebug = { source: 'env', projectId: fromEnv.projectId!, clientEmail: fromEnv.clientEmail! };
    return fromEnv as any;
  }

  // 2) Credentials JSON path
  const credsPath = process.env.FIREBASE_CREDENTIALS_PATH;
  if (credsPath) {
    try {
      // Treat relative paths as relative to repo root preference, then cwd
      const absoluteFromRepo = path.isAbsolute(credsPath)
        ? credsPath
        : path.resolve(process.cwd(), '..', '..', credsPath);
      const absoluteFromCwd = path.isAbsolute(credsPath)
        ? credsPath
        : path.resolve(process.cwd(), credsPath);
      const chosenPath = fs.existsSync(absoluteFromRepo)
        ? absoluteFromRepo
        : fs.existsSync(absoluteFromCwd)
          ? absoluteFromCwd
          : absoluteFromRepo; // default to repo path for error messaging
      const exists = fs.existsSync(chosenPath);
      if (!isProd) {
        // eslint-disable-next-line no-console
        console.log('[AuthFirebase] FIREBASE_CREDENTIALS_PATH provided', {
          cwd: process.cwd(),
          provided: credsPath,
          absoluteFromCwd,
          absoluteFromRepo,
          chosenPath,
          exists,
        });
      }
      if (exists) {
        const raw = fs.readFileSync(chosenPath, 'utf8');
        const json = JSON.parse(raw);
        const pj = json.project_id || json.projectId;
        const ce = json.client_email || json.clientEmail;
        const pk = json.private_key || json.privateKey;
        if (pj && ce && pk) {
          if (!isProd) {
            // eslint-disable-next-line no-console
            console.log('[AuthFirebase] Loaded credentials JSON from path.', {
              projectId: pj,
              clientEmail: ce,
            });
          }
          lastCredentialDebug = { source: 'path', projectId: pj, clientEmail: ce, provided: credsPath, chosenPath, exists };
          return { projectId: pj, clientEmail: ce, privateKey: pk };
        }
      }
    } catch {}
  }

  // 2b) Auto-discover a credentials JSON at repo root
  try {
    const autoPath = findDefaultCredentialsJson();
    if (autoPath) {
      const raw = fs.readFileSync(autoPath, 'utf8');
      const json = JSON.parse(raw);
      const pj = json.project_id || json.projectId;
      const ce = json.client_email || json.clientEmail;
      const pk = json.private_key || json.privateKey;
      if (pj && ce && pk) {
        if (!isProd) {
          // eslint-disable-next-line no-console
          console.log('[AuthFirebase] Auto-discovered credentials JSON at repo root.', {
            projectId: pj,
            clientEmail: ce,
            path: autoPath,
          });
        }
        lastCredentialDebug = { source: 'path', projectId: pj, clientEmail: ce, provided: '<auto>', chosenPath: autoPath, exists: true };
        return { projectId: pj, clientEmail: ce, privateKey: pk };
      }
    }
  } catch {}

  // 3) Inline JSON content
  const credsJson = process.env.FIREBASE_CREDENTIALS_JSON;
  if (credsJson) {
    try {
      const json = JSON.parse(credsJson);
      const pj = json.project_id || json.projectId;
      const ce = json.client_email || json.clientEmail;
      const pk = json.private_key || json.privateKey;
      if (pj && ce && pk) {
        if (!isProd) {
          // eslint-disable-next-line no-console
          console.log('[AuthFirebase] Using credentials from FIREBASE_CREDENTIALS_JSON.', {
            projectId: pj,
            clientEmail: ce,
          });
        }
        lastCredentialDebug = { source: 'json', projectId: pj, clientEmail: ce };
        return { projectId: pj, clientEmail: ce, privateKey: pk };
      }
    } catch {}
  }

  return null;
};

const adminApp = (): App => {
  if (getApps().length) {
    return getApps()[0];
  }
  const serviceAccount = resolveServiceAccount();
  if (serviceAccount) {
    return initializeApp({
      credential: cert(serviceAccount),
    });
  }

  // Strict mode: surface a clear error instead of silently returning a dummy app
  const hints: string[] = [];
  const missing: string[] = [];
  if (!process.env.FIREBASE_PROJECT_ID) missing.push('FIREBASE_PROJECT_ID');
  if (!process.env.FIREBASE_CLIENT_EMAIL) missing.push('FIREBASE_CLIENT_EMAIL');
  if (!process.env.FIREBASE_PRIVATE_KEY) missing.push('FIREBASE_PRIVATE_KEY');
  const credsPath = process.env.FIREBASE_CREDENTIALS_PATH;
  if (credsPath && !isProd) {
    const absCwd = path.isAbsolute(credsPath) ? credsPath : path.resolve(process.cwd(), credsPath);
    const absRepo = path.isAbsolute(credsPath) ? credsPath : path.resolve(process.cwd(), '..', '..', credsPath);
    const existsCwd = fs.existsSync(absCwd);
    const existsRepo = fs.existsSync(absRepo);
    // eslint-disable-next-line no-console
    console.warn('[AuthFirebase] Could not initialize from provided FIREBASE_CREDENTIALS_PATH.', {
      provided: credsPath,
      absCwd,
      existsCwd,
      absRepo,
      existsRepo,
    });
  }
  hints.push(
    `Either set env triplet (${missing.join(', ') || 'all present'}) or provide FIREBASE_CREDENTIALS_PATH or FIREBASE_CREDENTIALS_JSON.`
  );
  throw new Error(
    `Firebase Admin not initialized. ${hints.join(' ')} ` +
      'Private key in env must use \\n for newlines when provided via .env.'
  );
};

export const createSessionCookie = async (idToken: string, expiresIn: number) => {
  const auth = getAuth(adminApp());
  return auth.createSessionCookie(idToken, { expiresIn });
};

export const verifySessionCookie = async (cookie: string) => {
  const auth = getAuth(adminApp());
  return auth.verifySessionCookie(cookie, true);
};

export const revokeSessionCookie = async (sessionCookie: string) => {
  const auth = getAuth(adminApp());
  const decodedClaims = await auth.verifySessionCookie(sessionCookie);
  return auth.revokeRefreshTokens(decodedClaims.sub);
};
