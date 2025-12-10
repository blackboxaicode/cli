#!/usr/bin/env bash
set -euo pipefail

# Ensure zip is available (Ubuntu/Debian)
# sudo apt-get update && sudo apt-get install -y zip

# Set staging directory
STAGE="_release"

# Clean up any previous staging directory and zip
rm -rf "$STAGE" build.zip

# Create staging directory
mkdir -p "$STAGE"

# 1) Copy the entire bundle/ folder into the staging dir
cp -a bundle "$STAGE/"

# 2) Copy only packages/*/dist into the staging dir, preserving structure
while IFS= read -r -d '' dist; do
    dest="$STAGE/$dist"
    mkdir -p "$dest"
    cp -a "$dist"/. "$dest"/
done < <(find packages -mindepth 2 -maxdepth 2 -type d -name dist -print0)

# 3) Copy package.json files from packages/*/ into the staging dir
while IFS= read -r -d '' pkg_json; do
    # Extract the package directory (e.g., packages/core from packages/core/package.json)
    pkg_dir=$(dirname "$pkg_json")
    dest="$STAGE/$pkg_dir"
    mkdir -p "$dest"
    cp -a "$pkg_json" "$dest/"
done < <(find packages -mindepth 2 -maxdepth 2 -type f -name package.json -print0)

# 4) Create the zip from the staging dir
( cd "$STAGE" && zip -r ../build.zip . )

# Optional: Clean up staging directory
rm -rf "$STAGE"
