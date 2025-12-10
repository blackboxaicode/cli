#!/usr/bin/env node

/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import './src/gemini.js';
import { main } from './src/gemini.js';
import { FatalError } from '@blackbox_ai/blackbox-cli-core';
import { preLaunchUpdateCheck } from './src/utils/preLaunchUpdateCheck.js';

// --- Global Entry Point ---
// First, check for updates before starting the CLI
preLaunchUpdateCheck()
  .then(() => {
    // After update check (and potential update), start the main CLI
    return main();
  })
  .catch((error) => {
    if (error instanceof FatalError) {
      let errorMessage = error.message;
      if (!process.env['NO_COLOR']) {
        errorMessage = `\x1b[31m${errorMessage}\x1b[0m`;
      }
      console.error(errorMessage);
      process.exit(error.exitCode);
    }
    console.error('An unexpected critical error occurred:');
    if (error instanceof Error) {
      console.error(error.stack);
    } else {
      console.error(String(error));
    }
    process.exit(1);
  });
