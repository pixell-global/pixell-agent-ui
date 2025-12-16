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
  
  // Debug logging for env triplet
  if (!isProd) {
    const missingEnv = [];
    if (!fromEnv.projectId) missingEnv.push('FIREBASE_PROJECT_ID');
    if (!fromEnv.clientEmail) missingEnv.push('FIREBASE_CLIENT_EMAIL');
    if (!fromEnv.privateKey) missingEnv.push('FIREBASE_PRIVATE_KEY');
    if (missingEnv.length > 0) {
      // eslint-disable-next-line no-console
      console.log('[AuthFirebase] Env triplet check failed - missing:', missingEnv.join(', '));
    }
  }
  
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
        } else {
          if (!isProd) {
            const missingInJson = [];
            if (!pj) missingInJson.push('project_id/projectId');
            if (!ce) missingInJson.push('client_email/clientEmail');
            if (!pk) missingInJson.push('private_key/privateKey');
            // eslint-disable-next-line no-console
            console.warn('[AuthFirebase] JSON file exists but missing required fields:', missingInJson.join(', '));
          }
        }
      } else {
        if (!isProd) {
          // eslint-disable-next-line no-console
          console.warn('[AuthFirebase] FIREBASE_CREDENTIALS_PATH file does not exist:', chosenPath);
        }
      }
    } catch (error) {
      if (!isProd) {
        // eslint-disable-next-line no-console
        console.error('[AuthFirebase] Error loading credentials from FIREBASE_CREDENTIALS_PATH:', error);
      }
    }
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
      } else {
        if (!isProd) {
          const missingInJson = [];
          if (!pj) missingInJson.push('project_id/projectId');
          if (!ce) missingInJson.push('client_email/clientEmail');
          if (!pk) missingInJson.push('private_key/privateKey');
          // eslint-disable-next-line no-console
          console.warn('[AuthFirebase] FIREBASE_CREDENTIALS_JSON exists but missing required fields:', missingInJson.join(', '));
        }
      }
    } catch (error) {
      if (!isProd) {
        // eslint-disable-next-line no-console
        console.error('[AuthFirebase] Error parsing FIREBASE_CREDENTIALS_JSON:', error);
      }
    }
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
  const envStatus: Record<string, { exists: boolean; hasValue: boolean; length?: number }> = {};
  
  // Check each environment variable
  const envVars = ['FIREBASE_PROJECT_ID', 'FIREBASE_CLIENT_EMAIL', 'FIREBASE_PRIVATE_KEY'];
  for (const envVar of envVars) {
    const value = process.env[envVar];
    const exists = envVar in process.env;
    const hasValue = !!value && value.trim().length > 0;
    envStatus[envVar] = {
      exists,
      hasValue,
      length: value ? value.length : 0,
    };
    if (!hasValue) {
      missing.push(envVar);
    }
  }
  
  // Check alternative methods
  const credsPath = process.env.FIREBASE_CREDENTIALS_PATH;
  const credsJson = process.env.FIREBASE_CREDENTIALS_JSON;
  
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
  
  // Build detailed error message
  const errorDetails: string[] = [];
  errorDetails.push('\n=== Firebase Admin 초기화 실패 ===');
  errorDetails.push('\n[환경 변수 상태]:');
  for (const [key, status] of Object.entries(envStatus)) {
    if (status.hasValue) {
      errorDetails.push(`  ✓ ${key}: 설정됨 (길이: ${status.length}자)`);
    } else if (status.exists) {
      errorDetails.push(`  ✗ ${key}: 설정되었지만 값이 비어있음`);
    } else {
      errorDetails.push(`  ✗ ${key}: 설정되지 않음`);
    }
  }
  
  if (credsPath) {
    errorDetails.push(`\n[FIREBASE_CREDENTIALS_PATH]: ${credsPath}`);
    const absCwd = path.isAbsolute(credsPath) ? credsPath : path.resolve(process.cwd(), credsPath);
    const absRepo = path.isAbsolute(credsPath) ? credsPath : path.resolve(process.cwd(), '..', '..', credsPath);
    errorDetails.push(`  - 절대 경로 (cwd 기준): ${absCwd} (존재: ${fs.existsSync(absCwd)})`);
    errorDetails.push(`  - 절대 경로 (repo 기준): ${absRepo} (존재: ${fs.existsSync(absRepo)})`);
  } else {
    errorDetails.push(`\n[FIREBASE_CREDENTIALS_PATH]: 설정되지 않음`);
  }
  
  if (credsJson) {
    errorDetails.push(`\n[FIREBASE_CREDENTIALS_JSON]: 설정됨 (길이: ${credsJson.length}자)`);
    try {
      const parsed = JSON.parse(credsJson);
      errorDetails.push(`  - project_id: ${parsed.project_id || parsed.projectId || '없음'}`);
      errorDetails.push(`  - client_email: ${parsed.client_email || parsed.clientEmail || '없음'}`);
      errorDetails.push(`  - private_key: ${parsed.private_key || parsed.privateKey ? '있음' : '없음'}`);
    } catch (e) {
      errorDetails.push(`  - JSON 파싱 실패: ${e instanceof Error ? e.message : '알 수 없는 오류'}`);
    }
  } else {
    errorDetails.push(`\n[FIREBASE_CREDENTIALS_JSON]: 설정되지 않음`);
  }
  
  errorDetails.push('\n[해결 방법]:');
  if (missing.length > 0) {
    errorDetails.push(`  1. 다음 환경 변수를 설정하세요: ${missing.join(', ')}`);
  }
  errorDetails.push('  2. 또는 FIREBASE_CREDENTIALS_PATH로 JSON 파일 경로를 지정하세요');
  errorDetails.push('  3. 또는 FIREBASE_CREDENTIALS_JSON에 JSON 문자열을 직접 제공하세요');
  errorDetails.push('\n[참고]:');
  errorDetails.push('  - FIREBASE_PRIVATE_KEY는 .env 파일에서 \\n을 사용하여 줄바꿈을 표현해야 합니다');
  errorDetails.push('  - 예: FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\\n...\\n-----END PRIVATE KEY-----\\n"');
  errorDetails.push('=====================================\n');
  
  hints.push(
    `Either set env triplet (${missing.join(', ') || 'all present'}) or provide FIREBASE_CREDENTIALS_PATH or FIREBASE_CREDENTIALS_JSON.`
  );
  
  const errorMessage = `Firebase Admin not initialized. ${hints.join(' ')} ` +
    'Private key in env must use \\n for newlines when provided via .env.' +
    errorDetails.join('\n');
  
  throw new Error(errorMessage);
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
