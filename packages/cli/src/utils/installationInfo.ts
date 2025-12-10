/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { isGitRepository } from '@blackbox_ai/blackbox-cli-core';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as childProcess from 'node:child_process';

export enum PackageManager {
  NPM = 'npm',
  YARN = 'yarn',
  PNPM = 'pnpm',
  PNPX = 'pnpx',
  BUN = 'bun',
  BUNX = 'bunx',
  HOMEBREW = 'homebrew',
  NPX = 'npx',
  SHELL_SCRIPT = 'shell_script',
  UNKNOWN = 'unknown',
}

export interface InstallationInfo {
  packageManager: PackageManager;
  isGlobal: boolean;
  updateCommand?: string;
  updateMessage?: string;
}

export function getInstallationInfo(
  projectRoot: string,
  isAutoUpdateDisabled: boolean,
): InstallationInfo {
  const cliPath = process.argv[1];
  if (!cliPath) {
    return { packageManager: PackageManager.UNKNOWN, isGlobal: false };
  }

  try {
    // Normalize path separators to forward slashes for consistent matching.
    const realPath = fs.realpathSync(cliPath).replace(/\\/g, '/');
    const normalizedProjectRoot = projectRoot?.replace(/\\/g, '/');
    const isGit = isGitRepository(process.cwd());

    // Check for shell script installation (custom installer)
    // Installed to ~/.blackbox-cli-v2 with wrapper at ~/.local/bin/blackbox
    const homeDir = process.env['HOME'] || process.env['USERPROFILE'] || '';
    const shellScriptInstallDir = path.join(homeDir, '.blackbox-cli-v2').replace(/\\/g, '/');
    const localBinBlackbox = path.join(homeDir, '.local', 'bin', 'blackbox').replace(/\\/g, '/');
    
    if (realPath.includes(shellScriptInstallDir) || 
        realPath.includes(localBinBlackbox) ||
        (process.env['BLACKBOX_INSTALL_DIR'] && realPath.includes(process.env['BLACKBOX_INSTALL_DIR']))) {
      return {
        packageManager: PackageManager.SHELL_SCRIPT,
        isGlobal: true,
        updateCommand: 'blackbox update',
        updateMessage: isAutoUpdateDisabled
          ? 'Update available. Run: blackbox update'
          : 'Attempting to automatically update now...',
      };
    }

    // Check for local git clone first (but not if BLACKBOX_INSTALL_DIR is set)
    if (
      isGit &&
      normalizedProjectRoot &&
      realPath.startsWith(normalizedProjectRoot) &&
      !realPath.includes('/node_modules/') &&
      !process.env['BLACKBOX_INSTALL_DIR']
    ) {
      return {
        packageManager: PackageManager.UNKNOWN, // Not managed by a package manager in this case
        isGlobal: false,
        updateCommand: 'blackbox update',
        updateMessage: 'Please run: blackbox update to update your CLI installation.',
      };
    }

    // Check for npx/pnpx
    if (realPath.includes('/.npm/_npx') || realPath.includes('/npm/_npx')) {
      return {
        packageManager: PackageManager.NPX,
        isGlobal: false,
        updateMessage: 'Running via npx, update not applicable.',
      };
    }
    if (realPath.includes('/.pnpm/_pnpx')) {
      return {
        packageManager: PackageManager.PNPX,
        isGlobal: false,
        updateMessage: 'Running via pnpx, update not applicable.',
      };
    }

    // Check for Homebrew
    if (process.platform === 'darwin') {
      try {
        // We do not support homebrew for now, keep forward compatibility for future use
        childProcess.execSync('brew list -1 | grep -q "^blackbox-cli$"', {
          stdio: 'ignore',
        });
        return {
          packageManager: PackageManager.HOMEBREW,
          isGlobal: true,
          updateMessage:
            'Installed via Homebrew. Please update with "brew upgrade".',
        };
      } catch (_error) {
        // continue to the next check
      }
    }

    // Check for pnpm
    if (realPath.includes('/.pnpm/global')) {
      const updateCommand = 'pnpm add -g @blackbox_ai/blackbox-cli@latest';
      return {
        packageManager: PackageManager.PNPM,
        isGlobal: true,
        updateCommand,
        updateMessage: isAutoUpdateDisabled
          ? `Please run ${updateCommand} to update`
          : 'Installed with pnpm. Attempting to automatically update now...',
      };
    }

    // Check for yarn
    if (realPath.includes('/.yarn/global')) {
      const updateCommand = 'yarn global add @blackbox_ai/blackbox-cli@latest';
      return {
        packageManager: PackageManager.YARN,
        isGlobal: true,
        updateCommand,
        updateMessage: isAutoUpdateDisabled
          ? `Please run ${updateCommand} to update`
          : 'Installed with yarn. Attempting to automatically update now...',
      };
    }

    // Check for bun
    if (realPath.includes('/.bun/install/cache')) {
      return {
        packageManager: PackageManager.BUNX,
        isGlobal: false,
        updateMessage: 'Running via bunx, update not applicable.',
      };
    }
    if (realPath.includes('/.bun/bin')) {
      const updateCommand = 'bun add -g @blackbox_ai/blackbox-cli@latest';
      return {
        packageManager: PackageManager.BUN,
        isGlobal: true,
        updateCommand,
        updateMessage: isAutoUpdateDisabled
          ? `Please run ${updateCommand} to update`
          : 'Installed with bun. Attempting to automatically update now...',
      };
    }

    // Check for local install
    if (
      normalizedProjectRoot &&
      realPath.startsWith(`${normalizedProjectRoot}/node_modules`)
    ) {
      let pm = PackageManager.NPM;
      if (fs.existsSync(path.join(projectRoot, 'yarn.lock'))) {
        pm = PackageManager.YARN;
      } else if (fs.existsSync(path.join(projectRoot, 'pnpm-lock.yaml'))) {
        pm = PackageManager.PNPM;
      } else if (fs.existsSync(path.join(projectRoot, 'bun.lockb'))) {
        pm = PackageManager.BUN;
      }
      return {
        packageManager: pm,
        isGlobal: false,
        updateMessage:
          "Locally installed. Please update via your project's package.json.",
      };
    }

    // Assume global npm
    const updateCommand = 'npm install -g @blackbox_ai/blackbox-cli@latest';
    return {
      packageManager: PackageManager.NPM,
      isGlobal: true,
      updateCommand,
      updateMessage: isAutoUpdateDisabled
        ? `Please run ${updateCommand} to update`
        : 'Installed with npm. Attempting to automatically update now...',
    };
  } catch (error) {
    console.log(error);
    return { packageManager: PackageManager.UNKNOWN, isGlobal: false };
  }
}
