/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { UpdateInfo } from 'update-notifier';
import semver from 'semver';
import {
  isShellScriptInstallation,
  getCurrentVersion,
  fetchLatestVersionFromAPI,
  getPlatformString,
} from '../../utils/versionStorage.js';

export const FETCH_TIMEOUT_MS = 2000;

export interface UpdateObject {
  message: string;
  update: UpdateInfo;
}

/**
 * Checks for updates for shell script installations using the releases API
 * Only shows message when auto-update is disabled (pre-launch handles auto-update)
 */
async function checkForUpdatesShellScript(): Promise<UpdateObject | null> {
  try {
    const currentVersion = await getCurrentVersion();
    if (!currentVersion) {
      return null;
    }

    const platform = getPlatformString();
    const latestVersion = await fetchLatestVersionFromAPI(platform);
    
    if (!latestVersion) {
      return null;
    }

    // Compare versions
    if (semver.gt(latestVersion, currentVersion)) {
      const message = `Update available: ${currentVersion} → ${latestVersion}\nRun: blackbox update`;
      return {
        message,
        update: {
          latest: latestVersion,
          current: currentVersion,
          type: 'latest',
          name: 'blackbox-cli-v2',
        },
      };
    }

    return null;
  } catch (_error) {
    return null;
  }
}

export async function checkForUpdates(): Promise<UpdateObject | null> {
  try {
    // Skip update check when running from source (development mode)
    if (process.env['DEV'] === 'true') {
      return null;
    }

    // For shell script installations, check releases API
    // Note: Pre-launch check handles auto-update, this only shows message when disabled
    if (isShellScriptInstallation()) {
      return await checkForUpdatesShellScript();
    }

    // For npm installations, no update check (deprecated)
    return null;
  } catch (_error) {
    return null;
  }
}
