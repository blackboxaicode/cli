# Blackbox Code Execution and Deployment

This document describes how to run Blackbox Code and explains the deployment architecture that Blackbox Code uses.

## Running Blackbox Code

There are several ways to run Blackbox Code. The option you choose depends on how you intend to use it.

---

### 1. Standard installation (Recommended for typical users)

This is the recommended way for end-users to install Blackbox Code. It involves downloading the Blackbox Code package from the NPM registry.

- **Global install:**

  ```bash
  npm install -g @blackbox_ai/blackbox-cli
  ```

  Then, run the CLI from anywhere:

  ```bash
  blackbox
  ```

- **NPX execution:**

  ```bash
  # Execute the latest version from NPM without a global install
  npx @blackbox_ai/blackbox-cli
  ```

---

### 2. Running in a sandbox (Docker/Podman)

For security and isolation, Blackbox Code can be run inside a container. This is the default way that the CLI executes tools that might have side effects.

- **Directly from the Registry:**
  You can run the published sandbox image directly. This is useful for environments where you only have Docker and want to run the CLI.
  ```bash
  # Run the published sandbox image
  docker run --rm -it ghcr.io/blackbox_ai/blackbox-cli:0.0.7
  ```
- **Using the `--sandbox` flag:**
  If you have Blackbox Code installed locally (using the standard installation described above), you can instruct it to run inside the sandbox container.
  ```bash
  blackbox --sandbox -y -p "your prompt here"
  ```

---

### 3. Running from source (Recommended for Blackbox Code contributors)

Contributors to the project will want to run the CLI directly from the source code.

- **Development Mode:**
  This method provides hot-reloading and is useful for active development.
  ```bash
  # From the root of the repository
  npm run start
  ```
- **Production-like mode (Linked package):**
  This method simulates a global installation by linking your local package. It's useful for testing a local build in a production workflow.

  ```bash
  # Link the local cli package to your global node_modules
  npm link packages/cli

  # Now you can run your local version using the `blackbox` command
  blackbox
  ```

---

### 4. Running the latest Blackbox Code commit from GitHub

You can run the most recently committed version of Blackbox Code directly from the GitHub repository. This is useful for testing features still in development.

```bash
# Execute the CLI directly from the main branch on GitHub
npx https://github.com/llmcod/blackbox_cli
```

## Deployment architecture

The execution methods described above are made possible by the following architectural components and processes:

**NPM packages**

Blackbox Code project is a monorepo that publishes core packages to the NPM registry:

- `@blackbox_ai/blackbox-cli-core`: The backend, handling logic and tool execution.
- `@blackbox_ai/blackbox-cli`: The user-facing frontend.

These packages are used when performing the standard installation and when running Blackbox Code from the source.

**Build and packaging processes**

There are two distinct build processes used, depending on the distribution channel:

- **NPM publication:** For publishing to the NPM registry, the TypeScript source code in `@blackbox_ai/blackbox-cli-core` and `@blackbox_ai/blackbox-cli` is transpiled into standard JavaScript using the TypeScript Compiler (`tsc`). The resulting `dist/` directory is what gets published in the NPM package. This is a standard approach for TypeScript libraries.

- **GitHub `npx` execution:** When running the latest version of Blackbox Code directly from GitHub, a different process is triggered by the `prepare` script in `package.json`. This script uses `esbuild` to bundle the entire application and its dependencies into a single, self-contained JavaScript file. This bundle is created on-the-fly on the user's machine and is not checked into the repository.

**Docker sandbox image**

The Docker-based execution method is supported by the `blackbox-cli-sandbox` container image. This image is published to a container registry and contains a pre-installed, global version of Blackbox Code.

## Release process

The release process is automated through GitHub Actions. The release workflow performs the following actions:

1.  Build the NPM packages using `tsc`.
2.  Publish the NPM packages to the artifact registry.
3.  Create GitHub releases with bundled assets.

### Manual Publishing

If you need to manually publish packages to npm (for testing or emergency releases), use the provided script:

```bash
# Show help and available options
./scripts/publish-packages.sh --help

# Dry-run to test the process without publishing
./scripts/publish-packages.sh --dry-run

# Publish CLI packages (core + cli) with 'latest' tag
./scripts/publish-packages.sh

# Publish with a specific npm tag (e.g., 'beta', 'next')
./scripts/publish-packages.sh --tag beta

# Include VSCode IDE Companion extension
./scripts/publish-packages.sh --publish-vscode

# Combine multiple options
./scripts/publish-packages.sh --tag beta --publish-vscode
./scripts/publish-packages.sh --dry-run --publish-vscode
```

**Available Options:**
- `--dry-run`: Test the publishing process without actually publishing
- `--tag TAG`: Specify the npm tag (default: `latest`)
- `--publish-vscode`: Also publish the VSCode IDE Companion extension
- `--help`: Show usage information

**Important:** The script ensures the correct publishing order:
1. Publishes `@blackbox_ai/blackbox-cli-core` first
2. Waits for npm registry propagation (30 seconds)
3. Updates the CLI package to reference the published core version
4. Rebuilds the CLI package with the updated dependency
5. Publishes `@blackbox_ai/blackbox-cli`
6. Optionally publishes `blackbox-cli-vscode-ide-companion` (if `--publish-vscode` is used)

This process is critical to avoid the `ERR_MODULE_NOT_FOUND` error that occurs when the CLI package references a local file path instead of the published npm package.

**Note on `npm publish --workspaces`:**
If you use `npm publish --workspaces` directly, it will publish all non-private packages simultaneously, which can cause the CLI package to be published with incorrect dependencies. Always use the provided script or follow the manual steps in the troubleshooting section to ensure correct publishing order.

### Troubleshooting Publishing Issues

If users report `Cannot find package '@blackbox_ai/blackbox-cli-core'` errors:

1. **Check the published CLI package:**
   ```bash
   npm view @blackbox_ai/blackbox-cli dependencies
   ```
   The `@blackbox_ai/blackbox-cli-core` dependency should show a version number (e.g., `0.0.2`), not a file path.

2. **Verify both packages are published:**
   ```bash
   npm view @blackbox_ai/blackbox-cli-core version
   npm view @blackbox_ai/blackbox-cli version
   ```

3. **If the CLI package has the wrong dependency:**
   - Republish using the manual publishing script
   - Or trigger a new automated release through GitHub Actions
