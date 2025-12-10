/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { getPackageJson } from './package.js';

/**
 * Gets the installation directory for shell script installations
 */
function getInstallDir(): string | null {
  const homeDir = process.env['HOME'] || process.env['USERPROFILE'];
  if (!homeDir) {
    return null;
  }
  
  // Check if BLACKBOX_INSTALL_DIR is set
  if (process.env['BLACKBOX_INSTALL_DIR']) {
    return process.env['BLACKBOX_INSTALL_DIR'];
  }
  
  // Default installation directory
  return path.join(homeDir, '.blackbox-cli-v2');
}

/**
 * Checks if this is a shell script installation
 */
export function isShellScriptInstallation(): boolean {
  // Check if BLACKBOX_CLI_V2_ROOT is set (set by wrapper script)
  if (process.env['BLACKBOX_CLI_V2_ROOT']) {
    return true;
  }
  
  // Check if BLACKBOX_INSTALL_DIR is set
  if (process.env['BLACKBOX_INSTALL_DIR']) {
    return true;
  }
  
  const installDir = getInstallDir();
  if (!installDir) {
    return false;
  }
  
  // Check if VERSION file exists in the install directory
  const versionFilePath = path.join(installDir, 'VERSION');
  if (fs.existsSync(versionFilePath)) {
    return true;
  }
  
  const cliPath = process.argv[1];
  if (!cliPath) {
    return false;
  }
  
  try {
    const realPath = fs.realpathSync(cliPath).replace(/\\/g, '/');
    const normalizedInstallDir = installDir.replace(/\\/g, '/');
    
    return realPath.includes(normalizedInstallDir) || 
           realPath.includes('/.local/bin/blackbox');
  } catch {
    return false;
  }
}

/**
 * Reads the version from the VERSION file for shell script installations
 */
export function readVersionFile(): string | null {
  const installDir = getInstallDir();
  if (!installDir) {
    return null;
  }
  
  const versionFilePath = path.join(installDir, 'VERSION');
  
  try {
    if (fs.existsSync(versionFilePath)) {
      const version = fs.readFileSync(versionFilePath, 'utf-8').trim();
      return version || null;
    }
  } catch (error) {
    console.warn('Failed to read VERSION file:', error);
  }
  
  return null;
}

/**
 * Writes the version to the VERSION file
 */
export function writeVersionFile(version: string): boolean {
  const installDir = getInstallDir();
  if (!installDir) {
    return false;
  }
  
  const versionFilePath = path.join(installDir, 'VERSION');
  
  try {
    fs.writeFileSync(versionFilePath, version.trim(), 'utf-8');
    return true;
  } catch (error) {
    console.warn('Failed to write VERSION file:', error);
    return false;
  }
}

/**
 * Gets the current version of the CLI
 * Always checks VERSION file first (for shell script installations)
 * Falls back to package.json for npm/development installations
 */
export async function getCurrentVersion(): Promise<string | null> {
  // Always check VERSION file first, regardless of installation type
  // This ensures that if a VERSION file exists, it takes precedence
  const versionFromFile = readVersionFile();
  if (versionFromFile) {
    return versionFromFile;
  }
  
  // Fallback to package.json for npm/development installations
  try {
    const packageJson = await getPackageJson();
    return packageJson?.version || '0.0.0';
  } catch {
    return '0.0.0';
  }
}

/**
 * Fetches the latest version from the releases API
 */
export async function fetchLatestVersionFromAPI(platform: string): Promise<string | null> {
  try {
    const EXTENSION_SERVICE_URL = process.env['EXTENSION_SERVICE_URL'] || 'https://releases.blackbox.ai';
    const PRODUCT_SLUG = 'blackbox-cli-v2';
    const url = `${EXTENSION_SERVICE_URL}/api/v0/latest?product=${PRODUCT_SLUG}&platform=${platform}`;
    
    const response = await fetch(url, {
      signal: AbortSignal.timeout(3000), // 10 second timeout for better reliability
    });
    
    if (!response.ok) {
      return null;
    }
    
    const data = await response.json() as { version?: string };
    return data.version || null;
  } catch (_error) {
    return null;
  }
}

/**
 * Gets the platform string for the current system
 */
export function getPlatformString(): string {
  const os = process.platform;
  const arch = process.arch;
  
  if (os === 'darwin') {
    return arch === 'arm64' ? 'mac-arm64' : 'mac-x64';
  } else if (os === 'linux') {
    return arch === 'arm64' ? 'linux-arm64' : 'linux-x64';
  } else if (os === 'win32') {
    return arch === 'arm64' ? 'windows-arm64' : 'windows-x64';
  }
  
  return 'unknown';
}
