/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { CommandModule } from 'yargs';
import { 
  isShellScriptInstallation, 
  getCurrentVersion,
  fetchLatestVersionFromAPI,
  getPlatformString 
} from '../utils/versionStorage.js';
import { getInstallationInfo, PackageManager } from '../utils/installationInfo.js';
import semver from 'semver';
import { execSync } from 'node:child_process';

export const updateCommand: CommandModule = {
  command: 'update',
  describe: 'Update Blackbox CLI to the latest version',
  handler: async () => {
    console.log('Checking for updates...\n');

    try {
      // Get current version
      const currentVersion = await getCurrentVersion();
      if (!currentVersion) {
        console.error('❌ Unable to determine current version.');
        process.exit(1);
      }

      console.log(`Current version: ${currentVersion}`);

      // Check if this is a shell script installation (has VERSION file or BLACKBOX_INSTALL_DIR)
      if (isShellScriptInstallation()) {
        const platform = getPlatformString();
        const latestVersion = await fetchLatestVersionFromAPI(platform);

        if (!latestVersion) {
          console.error('❌ Unable to fetch latest version from releases API.');
          process.exit(1);
        }

        console.log(`Latest version:  ${latestVersion}\n`);

        if (semver.gt(latestVersion, currentVersion)) {
          console.log(`📦 Updating from ${currentVersion} to ${latestVersion}...`);
          console.log('This may take a moment...\n');

          try {
            // Run the update script directly
            execSync('curl -fsSL https://shell.blackbox.ai/api/scripts/blackbox-cli-v2/download.sh | CONFIGURE=false bash', {
              stdio: 'inherit',
              env: { ...process.env, CONFIGURE: 'false' },
            });
            
            console.log(`\n✅ Update successful!`);
            console.log(`\nUpdated to version ${latestVersion}`);
            console.log('Please restart your terminal or run a new blackbox session to use the new version.');
          } catch (_error) {
            console.error(`\n❌ Update failed.`);
            console.error('\nYou can try updating manually with:');
            console.error('  curl -fsSL https://shell.blackbox.ai/api/scripts/blackbox-cli-v2/download.sh | bash');
            process.exit(1);
          }
        } else if (semver.eq(latestVersion, currentVersion)) {
          console.log('✅ You are already on the latest version!');
        } else {
          console.log(`ℹ️  You are on version ${currentVersion}, which is newer than the latest release (${latestVersion}).`);
          console.log('This might be a development or pre-release version.');
        }
      } else {
        // For other installations (npm, yarn, pnpm, git clone, etc.)
        const installationInfo = getInstallationInfo(process.cwd(), false);
        
        if (installationInfo.packageManager === PackageManager.UNKNOWN) {
          console.log('\n📝 Running from a local git clone or development environment.');
          console.log('To update, please run:');
          console.log('  git pull');
          console.log('  npm install');
          console.log('  npm run build');
        } else if (installationInfo.updateCommand) {
          console.log(`\nTo update, please run:`);
          console.log(`  ${installationInfo.updateCommand}`);
        } else {
          console.log('\n📝 Running from a local installation.');
          console.log('Please update via your package manager or reinstall.');
        }
      }

    } catch (error) {
      console.error('❌ Update failed:', error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  },
};
