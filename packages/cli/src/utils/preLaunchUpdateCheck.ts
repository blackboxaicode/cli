/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { execSync } from 'node:child_process';
import {
  isShellScriptInstallation,
  getCurrentVersion,
  fetchLatestVersionFromAPI,
  getPlatformString,
} from './versionStorage.js';
import semver from 'semver';
import { loadSettings } from '../config/settings.js';

/**
 * Checks for updates before CLI launch and auto-updates if enabled
 * This runs BEFORE the main CLI process starts, so it can update files safely
 */
export async function preLaunchUpdateCheck(): Promise<void> {
  // Only check for shell script installations
  if (!isShellScriptInstallation()) {
    return;
  }

  try {
    // Load settings to check if auto-update is enabled
    const settings = await loadSettings(process.cwd());
    const autoUpdateDisabled = settings.merged.general?.disableAutoUpdate ?? false;

    // Get current and latest versions
    const currentVersion = await getCurrentVersion();
    if (!currentVersion) {
      return;
    }

    const platform = getPlatformString();
    const latestVersion = await fetchLatestVersionFromAPI(platform);
    
    // If we can't fetch the latest version (timeout, network error, etc.), 
    // silently continue without blocking CLI startup
    if (!latestVersion) {
      return;
    }

    // Check if update is available
    if (!semver.gt(latestVersion, currentVersion)) {
      return; // No update available
    }

    // If auto-update is disabled, just return (will show message in CLI)
    if (autoUpdateDisabled) {
      return;
    }

    // Auto-update is enabled - perform update with visible logs
    console.log(`\nUpdating Blackbox CLI from ${currentVersion} to ${latestVersion}...`);
    console.log('This will only take a moment...\n');
    console.log(`\nTo disable automatic updates, run: blackbox configure`);
    console.log(` Or add "disableAutoUpdate": true to your .blackbox/config.json\n`);

    const updateCommand = 'curl -fsSL https://shell.blackbox.ai/api/scripts/blackbox-cli-v2/download.sh | CONFIGURE=false bash';
    
    try {
      // Run update synchronously and show output to user
      execSync(updateCommand, {
        stdio: 'inherit', // Show installation logs to user
        env: { ...process.env, CONFIGURE: 'false' },
      });

      
      
      console.log(`\nSuccessfully updated to version ${latestVersion}!`);
      console.log(`Please run the blackbox command again to use the new version. Happy coding!\n`);
      
      // Exit cleanly after update - user needs to run command again
      process.exit(0);
      
      
    } catch (_error) {
      // Update failed - continue with current version
      console.error('\n⚠️  Update failed. Continuing with current version...');
      console.error('💡 You can try updating manually with: blackbox update\n');
      // Don't block CLI startup on update failure
    }
  } catch (_error) {
    // Silently fail - don't block CLI startup on any errors
  }
}
