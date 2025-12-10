/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { getPackageJson } from './package.js';
import { getCurrentVersion } from './versionStorage.js';

export async function getCliVersion(): Promise<string> {
  // Check environment variable first
  if (process.env['CLI_VERSION']) {
    return process.env['CLI_VERSION'];
  }
  
  // For shell script installations, use VERSION file
  const versionFromStorage = await getCurrentVersion();
  if (versionFromStorage) {
    return versionFromStorage;
  }
  
  // Fallback to package.json
  const pkgJson = await getPackageJson();
  return pkgJson?.version || 'unknown';
}
