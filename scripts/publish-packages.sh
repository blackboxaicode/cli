#!/bin/bash

# Script to manually publish packages to npm
# This ensures the correct order and dependency updates

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Default values
DRY_RUN=""
NPM_TAG="latest"
PUBLISH_VSCODE="no"

# Parse command line arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --dry-run)
      DRY_RUN="--dry-run"
      shift
      ;;
    --tag)
      NPM_TAG="$2"
      shift 2
      ;;
    --publish-vscode)
      PUBLISH_VSCODE="yes"
      shift
      ;;
    --help)
      echo "Usage: ./scripts/publish-packages.sh [OPTIONS]"
      echo ""
      echo "Options:"
      echo "  --dry-run           Run without actually publishing (for testing)"
      echo "  --tag TAG           NPM tag to use (default: latest)"
      echo "  --publish-vscode    Also publish the VSCode IDE Companion extension"
      echo "  --help              Show this help message"
      echo ""
      echo "Examples:"
      echo "  ./scripts/publish-packages.sh --dry-run"
      echo "  ./scripts/publish-packages.sh --tag beta"
      echo "  ./scripts/publish-packages.sh --publish-vscode"
      echo "  ./scripts/publish-packages.sh --tag latest --publish-vscode"
      exit 0
      ;;
    *)
      echo -e "${RED}Unknown option: $1${NC}"
      echo "Use --help for usage information"
      exit 1
      ;;
  esac
done

# Get the version from package.json
VERSION=$(node -p "require('./package.json').version")

echo -e "${YELLOW}Publishing Blackbox CLI packages v${VERSION}${NC}"
echo ""

if [[ -n "$DRY_RUN" ]]; then
  echo -e "${YELLOW}Running in DRY-RUN mode (no actual publishing)${NC}"
  echo ""
fi

echo -e "${YELLOW}Using npm tag: ${NPM_TAG}${NC}"
echo ""

# Step 1: Build all packages
echo -e "${GREEN}Step 1: Building packages...${NC}"
npm run build:packages
npm run prepare:package
echo ""

# Step 2: Publish core package
echo -e "${GREEN}Step 2: Publishing @blackbox_ai/blackbox-cli-core...${NC}"
npm publish --workspace=@blackbox_ai/blackbox-cli-core --access public --tag="${NPM_TAG}" ${DRY_RUN}
echo ""

# Step 3: Wait for npm registry (only if not dry-run)
if [[ -z "$DRY_RUN" ]]; then
  echo -e "${YELLOW}Step 3: Waiting 30 seconds for npm registry to propagate...${NC}"
  sleep 30
  echo ""
  
  # Step 4: Update CLI to use published core package
  echo -e "${GREEN}Step 4: Updating CLI to use published core package...${NC}"
  npm install "@blackbox_ai/blackbox-cli-core@${VERSION}" --workspace=@blackbox_ai/blackbox-cli --save-exact
  echo ""
  
  # Step 5: Rebuild CLI package
  echo -e "${GREEN}Step 5: Rebuilding CLI package with updated dependency...${NC}"
  npm run build --workspace=@blackbox_ai/blackbox-cli
  echo ""
else
  echo -e "${YELLOW}Step 3-5: Skipped (dry-run mode)${NC}"
  echo ""
fi

# Step 6: Publish CLI package
echo -e "${GREEN}Step 6: Publishing @blackbox_ai/blackbox-cli...${NC}"
npm publish --workspace=@blackbox_ai/blackbox-cli --access public --tag="${NPM_TAG}" ${DRY_RUN}
echo ""

# Step 7: Publish VSCode IDE Companion (optional)
if [[ "$PUBLISH_VSCODE" == "yes" ]]; then
  echo -e "${GREEN}Step 7: Publishing blackbox-cli-vscode-ide-companion...${NC}"
  npm publish --workspace=blackbox-cli-vscode-ide-companion --access public --tag="${NPM_TAG}" ${DRY_RUN}
  echo ""
else
  echo -e "${YELLOW}Step 7: Skipping VSCode IDE Companion (use --publish-vscode flag to include)${NC}"
  echo ""
fi

if [[ -z "$DRY_RUN" ]]; then
  echo -e "${GREEN}✓ Successfully published packages!${NC}"
  echo ""
  echo -e "Published packages:"
  echo -e "  - @blackbox_ai/blackbox-cli-core@${VERSION}"
  echo -e "  - @blackbox_ai/blackbox-cli@${VERSION}"
  if [[ "$PUBLISH_VSCODE" == "yes" ]]; then
    echo -e "  - blackbox-cli-vscode-ide-companion@${VERSION}"
  fi
  echo ""
  echo -e "${YELLOW}Note: It may take a few minutes for the packages to be available on npm.${NC}"
else
  echo -e "${GREEN}✓ Dry-run completed successfully!${NC}"
  echo ""
  echo -e "${YELLOW}To publish for real, run: ./scripts/publish-packages.sh${NC}"
  echo -e "${YELLOW}To include VSCode extension: ./scripts/publish-packages.sh --publish-vscode${NC}"
  echo -e "${YELLOW}To use a different tag: ./scripts/publish-packages.sh --tag beta${NC}"
fi
