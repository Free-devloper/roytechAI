#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [[ "${SITES_ENV_READY:-}" != "1" ]]; then
  exec bash "${script_dir}/sites-env.sh" -- "$0" "$@"
fi

vinext="${SITES_PROJECT_ROOT}/node_modules/.bin/vinext"

echo "Running vinext build..."
if command -v timeout >/dev/null 2>&1; then
  if [[ -x "${vinext}" ]]; then
    timeout \
      --signal=TERM \
      --kill-after="${SITES_BUILD_KILL_AFTER:-10s}" \
      "${SITES_BUILD_TIMEOUT:-3m}" \
      "${vinext}" build
  else
    timeout \
      --signal=TERM \
      --kill-after="${SITES_BUILD_KILL_AFTER:-10s}" \
      "${SITES_BUILD_TIMEOUT:-3m}" \
      npx vinext build
  fi
else
  if [[ -x "${vinext}" ]]; then
    "${vinext}" build
  else
    npx vinext build
  fi
fi

if [[ -f "${script_dir}/validate-artifact.sh" ]]; then
  bash "${script_dir}/validate-artifact.sh" || true
fi

mkdir -p "${SITES_PROJECT_ROOT}/.next"
echo "vinext-build" > "${SITES_PROJECT_ROOT}/.next/BUILD_ID"
