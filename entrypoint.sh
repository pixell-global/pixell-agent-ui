#!/bin/sh
set -e

# Load environment variables from /app/.env if present
if [ -f /app/.env ]; then
  echo "[entrypoint] Loading /app/.env"
  # shellcheck disable=SC2046
  export $(grep -E '^[A-Za-z_][A-Za-z0-9_]*=' /app/.env | xargs)
fi

# Emit runtime env for client-side consumption (Next.js app serves /public)
# This ensures window.NEXT_PUBLIC_* is available before any client code runs
# Write under apps/web/public to align with copied public path
RUNTIME_ENV_JS=/app/apps/web/public/runtime-env.js
echo "[entrypoint] Writing runtime env to ${RUNTIME_ENV_JS}"
cat > "$RUNTIME_ENV_JS" << 'EOF'
(function(){
  function set(k,v){
    if(typeof window === 'undefined') return;
    // Only set if not already defined to allow overrides
    if(window[k] == null){ window[k] = v || ''; }
  }
  // Values will be substituted by the shell below this heredoc
})();
EOF

# Append concrete values (avoid echoing secrets to stdout)
{
  echo "(function(){";
  echo "  function set(k,v){ if(typeof window==='undefined')return; if(window[k]==null){ window[k]=v||''; } }";
  [ -n "${NEXT_PUBLIC_FIREBASE_API_KEY:-}" ] && echo "  set('NEXT_PUBLIC_FIREBASE_API_KEY', '${NEXT_PUBLIC_FIREBASE_API_KEY}');" || true
  [ -n "${NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN:-}" ] && echo "  set('NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN', '${NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN}');" || true
  [ -n "${NEXT_PUBLIC_FIREBASE_PROJECT_ID:-}" ] && echo "  set('NEXT_PUBLIC_FIREBASE_PROJECT_ID', '${NEXT_PUBLIC_FIREBASE_PROJECT_ID}');" || true
  [ -n "${NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET:-}" ] && echo "  set('NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET', '${NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET}');" || true
  [ -n "${NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID:-}" ] && echo "  set('NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID', '${NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID}');" || true
  [ -n "${NEXT_PUBLIC_FIREBASE_APP_ID:-}" ] && echo "  set('NEXT_PUBLIC_FIREBASE_APP_ID', '${NEXT_PUBLIC_FIREBASE_APP_ID}');" || true
  echo "})();";
} >> "$RUNTIME_ENV_JS"

exec node apps/web/server.js


