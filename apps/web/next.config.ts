import type { NextConfig } from "next";
import path from "path";
import fs from "fs";

// Inject environment variables into the client bundle explicitly
function loadEnv() {
  const root = path.resolve(__dirname, "..", "..")
  const envName = process.env.PIXELL_ENV
  const candidates: string[] = []
  if (envName) candidates.push(path.join(root, `.env.${envName}`))
  candidates.push(path.join(root, ".env.local"))
  candidates.push(path.join(root, ".env"))

  for (const p of candidates) {
    if (!fs.existsSync(p)) continue
    try {
      const content = fs.readFileSync(p, "utf8")
      for (const raw of content.split(/\r?\n/)) {
        const line = raw.trim()
        if (!line || line.startsWith("#")) continue
        const eq = line.indexOf("=")
        if (eq === -1) continue
        const k = line.substring(0, eq).trim()
        let v = line.substring(eq + 1).trim()
        if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
          v = v.slice(1, -1)
        }
        if (process.env[k] === undefined) process.env[k] = v
      }
      // eslint-disable-next-line no-console
      console.log(`[Next] env loaded from ${path.relative(root, p)} (PIXELL_ENV=${envName ?? 'n/a'})`)
      break
    } catch {}
  }
}

loadEnv()

const nextConfig: NextConfig = {
  // Ensure Next resolves the correct monorepo root for tracing and dev/build artifacts
  outputFileTracingRoot: path.resolve(__dirname, "..", ".."),
  env: {
    NEXT_PUBLIC_FIREBASE_API_KEY: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    NEXT_PUBLIC_FIREBASE_APP_ID: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  },
  // Force dynamic rendering for all pages
  trailingSlash: false,
  // Disable static generation to avoid Html import errors in Amplify
  output: 'export',
  distDir: '.next',
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
