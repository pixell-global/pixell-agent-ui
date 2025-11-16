#!/usr/bin/env bash
set -euo pipefail

# Preflight: verify Firebase env injection for apps/web without deploying
# - Builds the root Dockerfile for linux/amd64
# - Passes NEXT_PUBLIC_* from root .env.dev (or .env.local fallback)
# - Inspects container for:
#   1) /app/.env presence and values
#   2) runtime-env.js containing keys
#   3) .next bundle containing inlined values

ROOT_DIR=$(cd "$(dirname "$0")"/.. && pwd)
cd "$ROOT_DIR"

ENV_FILE=".env.dev"
if [[ ! -f "$ENV_FILE" ]]; then
  if [[ -f .env.local ]]; then ENV_FILE=".env.local"; else echo "No .env.dev or .env.local found."; exit 1; fi
fi

echo "Using env file: $ENV_FILE"

# Load envs
set -a
source "$ENV_FILE"
set +a

AWS_REGION=${AWS_REGION:-us-east-2}
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text 2>/dev/null || echo local)
IMAGE_TAG=verify-web-env:latest
IMAGE=${IMAGE_TAG}

if [[ "${1:-}" == "--inspect-ecr" ]]; then
  IMAGE="${ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/pixell-web:latest"
  echo "Skipping build; inspecting ECR image: $IMAGE"
else
  echo "Building image $IMAGE_TAG (linux/amd64) with build args..."
  docker buildx inspect default >/dev/null 2>&1 || docker buildx create --use
  docker buildx build --platform linux/amd64 \
    --build-arg APP_ENV=dev \
    --build-arg NEXT_PUBLIC_FIREBASE_API_KEY="${NEXT_PUBLIC_FIREBASE_API_KEY:-}" \
    --build-arg NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN="${NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN:-}" \
    --build-arg NEXT_PUBLIC_FIREBASE_PROJECT_ID="${NEXT_PUBLIC_FIREBASE_PROJECT_ID:-}" \
    --build-arg NEXT_PUBLIC_FIREBASE_APP_ID="${NEXT_PUBLIC_FIREBASE_APP_ID:-}" \
    --build-arg NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID="${NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID:-}" \
    --build-arg NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET="${NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET:-}" \
    -t $IMAGE --load .
fi

echo
echo "[1/4] Checking /app/.env inside the image..."
docker run --platform linux/amd64 --rm $IMAGE sh -lc 'sed -n "1,200p" /app/.env | sed -n "/# -----------------------------\n# Firebase (Client SDK)/,/# -----------------------------/p"'

echo
echo "[2/4] Running entrypoint to emit runtime-env.js..."
docker run --platform linux/amd64 --rm $IMAGE sh -lc "/entrypoint.sh >/dev/null 2>&1 & sleep 1; head -n 50 /app/apps/web/public/runtime-env.js || true"

echo
echo "[3/4] Searching for inlined Firebase values in .next bundle (build-time inlining)..."
SEARCH1=${NEXT_PUBLIC_FIREBASE_API_KEY:-__MISSING__}
SEARCH2=${NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN:-__MISSING__}
docker run --platform linux/amd64 --rm $IMAGE sh -lc 'set -e; SEARCH1="'"$SEARCH1"'"; SEARCH2="'"$SEARCH2"'"; M1=0; M2=0; if grep -R -n -F "$SEARCH1" /app/apps/web/.next >/dev/null 2>&1; then M1=1; fi; if grep -R -n -F "$SEARCH2" /app/apps/web/.next >/dev/null 2>&1; then M2=1; fi; echo InlineMatch_KEY=$M1; echo InlineMatch_DOMAIN=$M2; if [ "$M1" = 1 ]; then grep -R -n -F "$SEARCH1" /app/apps/web/.next | head -n 3; fi; if [ "$M2" = 1 ]; then grep -R -n -F "$SEARCH2" /app/apps/web/.next | head -n 3; fi;'

echo
echo "[4/4] Storage environment overview (from host env file):"
echo "- STORAGE_PROVIDER=${STORAGE_PROVIDER:-local}"
if [ "${STORAGE_PROVIDER:-local}" = "s3" ]; then
  echo "  STORAGE_S3_BUCKET=${STORAGE_S3_BUCKET:-__MISSING__}"
echo "  STORAGE_S3_REGION=${STORAGE_S3_REGION:-us-east-2}"
  [ -n "${S3_FILE_STORAGE_URL:-}" ] && echo "  S3_FILE_STORAGE_URL=${S3_FILE_STORAGE_URL}"
  echo "  STORAGE_S3_PREFIX=${STORAGE_S3_PREFIX:-workspace-files} (org-scoped=${STORAGE_S3_ORG_SCOPED:-true})"
  echo "  ACCESS_KEY_ID set? $([ -n "${STORAGE_S3_ACCESS_KEY_ID:-}${AWS_ACCESS_KEY_ID:-}" ] && echo yes || echo no)"
  echo "  SECRET_ACCESS_KEY set? $([ -n "${STORAGE_S3_SECRET_ACCESS_KEY:-}${AWS_SECRET_ACCESS_KEY:-}" ] && echo yes || echo no)"
else
  echo "  STORAGE_LOCAL_PATH=${STORAGE_LOCAL_PATH:-./workspace-files}"
fi

echo
echo "Done. If InlineMatch_* are 0, build-time inlining is NOT happening; use runtime window config or adjust Dockerfile."


