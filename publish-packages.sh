#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage: publish-packages.sh [--dev]

  --dev    Publish using the @lk_blackboxai scope (no scope replacement).

When --dev is omitted, every file in the repository has @lk_blackboxai replaced
with @blackbox_ai before the publish steps run.
EOF
}

is_dev=false
while [[ $# -gt 0 ]]; do
  case "$1" in
    --dev)
      is_dev=true
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage
      exit 1
      ;;
  esac
done

if [[ "$is_dev" == false ]]; then
  echo "Replacing @lk_blackboxai with @blackbox_ai across the repository..."
  while IFS= read -r -d '' file; do
    if grep -q '@lk_blackboxai' "$file"; then
      # macOS-compatible in-place replacement
      sed -i '' 's/@lk_blackboxai/@blackbox_ai/g' "$file"
    fi
  done < <(rg --files -0 --hidden --glob '!.git/**' --glob '!node_modules/**' --glob '!*.sh')
fi

if [[ "$is_dev" == true ]]; then
  while IFS= read -r -d '' file; do
    if grep -q '@blackbox_ai/blackbox-cli' "$file"; then
      # macOS-compatible in-place replacement
      sed -i '' 's/@blackbox_ai\/blackbox-cli/@lk_blackboxai\/blackbox-cli/g' "$file"
    fi
  done < <(rg --files -0 --hidden --glob '!.git/**' --glob '!node_modules/**' --glob '!*.sh')
fi

# Clean existing build artifacts to ensure a fresh publish.
# npm run clean

npm install

# Install dependencies exactly as locked for reproducibility.
npm ci

# Authenticate with required registries (safe to rerun even if already logged in).
npm run auth

# Build each workspace so dist assets are ready.
npm run build:packages

# Bundle the CLI entrypoint and copy packaged assets.
npm run bundle

# Prepare the root package (updates package metadata, etc.).
npm run prepare:package

# Publish all workspaces to npm with public access.
npm publish --workspaces --access public

# revert the replacements if --dev is used
if [[ "$is_dev" == true ]]; then
  while IFS= read -r -d '' file; do
    if grep -q '@lk_blackboxai' "$file"; then
      # macOS-compatible in-place replacement
      sed -i '' 's/@lk_blackboxai/@blackbox_ai/g' "$file"
    fi
  done < <(rg --files -0 --hidden --glob '!.git/**' --glob '!node_modules/**' --glob '!*.sh')
fi