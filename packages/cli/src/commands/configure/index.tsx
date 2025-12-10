/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { CommandModule } from 'yargs';
import { render } from 'ink';
import { ConfigureUI } from './ConfigureUI.js';
import { KeypressProvider } from '../../ui/contexts/KeypressContext.js';
import type { Config } from '@blackbox_ai/blackbox-cli-core';
import { addMcpServer } from '../mcp/add.js';

async function runConfigure(): Promise<string | undefined> {
  return new Promise((resolve) => {
    // Create a minimal config for KeypressProvider
    // We don't need full config functionality for the configure command
    const minimalConfig = {
      getDebugMode: () => false,
    } as Config;

    const { unmount } = render(
      <KeypressProvider
        kittyProtocolEnabled={false}
        pasteWorkaround={process.platform === 'win32'}
        config={minimalConfig}
        debugKeystrokeLogging={false}
      >
        <ConfigureUI
          onComplete={(providerName) => {
            unmount();
            resolve(providerName);
          }}
        />
      </KeypressProvider>,
    );
  });
}

export const configureCommand: CommandModule = {
  command: 'configure',
  describe: 'Configure Blackbox CLI provider and model settings',
  builder: (yargs) =>
    yargs
      .usage('Usage: blackbox configure')
      .example('blackbox configure', 'Start the configuration wizard')
      .help(),
  handler: async () => {
    const providerName = await runConfigure();
    
    // Automatically add remote-code MCP server if blackbox provider was configured
    if (providerName === 'blackbox') {
      const apiKey = process.env['BLACKBOX_API_KEY'];
      
      if (apiKey) {
        console.log('\n🔧 Setting up Blackbox Remote Code MCP Server...');
        
        try {
          await addMcpServer(
            'remote-code',
            '__preset__', // Placeholder for preset
            undefined,
            {
              scope: 'project',
              transport: 'http',
              env: undefined,
              header: undefined,
              timeout: undefined,
              trust: undefined,
              description: undefined,
              includeTools: undefined,
              excludeTools: undefined,
            }
          );
          console.log('✅ Remote Code MCP Server configured successfully!\n');
        } catch (error) {
          console.error('⚠️  Failed to configure Remote Code MCP Server:', error instanceof Error ? error.message : error);
          console.error('   You can manually add it later with: blackbox mcp add remote-code\n');
        }
      } else {
        console.log('\n⚠️  BLACKBOX_API_KEY not found in environment.');
        console.log('   To enable Remote Code MCP Server, set BLACKBOX_API_KEY and run:');
        console.log('   blackbox mcp add remote-code\n');
      }
    }
    
    process.exit(0);
  },
};
