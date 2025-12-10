/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { CommandModule } from 'yargs';
import { AuthType } from '@blackbox_ai/blackbox-cli-core';
import { loadSettings, SettingScope } from '../config/settings.js';
import {
  setBlackboxApiKey,
  setBlackboxApiBaseUrl,
  setBlackboxApiModel,
  setOpenAIApiKey,
  setOpenAIBaseUrl,
  setOpenAIModel,
} from '../config/auth.js';
import * as readline from 'node:readline';
import { stdin as input, stdout as output } from 'node:process';

interface ProviderConfig {
  name: string;
  displayName: string;
  authType: AuthType;
  requiresApiKey: boolean;
  defaultBaseUrl?: string;
  defaultModel: string;
  envKeyName?: string;
  envBaseUrlName?: string;
  envModelName?: string;
}

const PROVIDERS: ProviderConfig[] = [
  {
    name: 'blackbox',
    displayName: 'BlackboxAI',
    authType: AuthType.USE_BLACKBOX_API,
    requiresApiKey: true,
    defaultBaseUrl: 'https://api.blackbox.ai/v1',
    defaultModel: 'blackbox-ai',
    envKeyName: 'BLACKBOX_API_KEY',
    envBaseUrlName: 'BLACKBOX_API_BASE_URL',
    envModelName: 'BLACKBOX_API_MODEL',
  },
  {
    name: 'openai',
    displayName: 'OpenAI',
    authType: AuthType.USE_OPENAI,
    requiresApiKey: true,
    defaultBaseUrl: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4',
    envKeyName: 'OPENAI_API_KEY',
    envBaseUrlName: 'OPENAI_BASE_URL',
    envModelName: 'OPENAI_MODEL',
  },
];

function createReadlineInterface() {
  return readline.createInterface({
    input,
    output,
    terminal: true,
  });
}

function question(rl: readline.Interface, prompt: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(prompt, (answer) => {
      resolve(answer.trim());
    });
  });
}

function questionPassword(
  rl: readline.Interface,
  prompt: string,
): Promise<string> {
  return new Promise((resolve) => {
    // Disable echo for password input
    const stdin = process.stdin as NodeJS.ReadStream & { setRawMode?: (mode: boolean) => void };
    const originalRawMode = stdin.isRaw;
    
    if (stdin.setRawMode) {
      stdin.setRawMode(true);
    }

    output.write(prompt);
    let password = '';

    const onData = (char: Buffer) => {
      const str = char.toString('utf8');
      
      // Handle different key presses
      if (str === '\n' || str === '\r' || str === '\r\n') {
        // Enter key
        output.write('\n');
        stdin.removeListener('data', onData);
        if (stdin.setRawMode) {
          stdin.setRawMode(originalRawMode);
        }
        resolve(password);
      } else if (str === '\u0003') {
        // Ctrl+C
        output.write('\n');
        stdin.removeListener('data', onData);
        if (stdin.setRawMode) {
          stdin.setRawMode(originalRawMode);
        }
        process.exit(0);
      } else if (str === '\u007f' || str === '\b') {
        // Backspace
        if (password.length > 0) {
          password = password.slice(0, -1);
          output.write('\b \b');
        }
      } else if (str.charCodeAt(0) >= 32) {
        // Printable character
        password += str;
        output.write('*');
      }
    };

    stdin.on('data', onData);
  });
}

async function selectProvider(rl: readline.Interface): Promise<ProviderConfig> {
  console.log('\n📦 Available Providers:\n');
  PROVIDERS.forEach((provider, index) => {
    console.log(`  ${index + 1}. ${provider.displayName}`);
  });
  console.log();

  while (true) {
    const answer = await question(
      rl,
      'Select a provider (enter number): ',
    );
    const index = parseInt(answer, 10) - 1;

    if (index >= 0 && index < PROVIDERS.length) {
      return PROVIDERS[index];
    }

    console.log('❌ Invalid selection. Please try again.\n');
  }
}

async function configureProvider(
  provider: ProviderConfig,
  rl: readline.Interface,
): Promise<{
  apiKey: string;
  baseUrl: string;
  model: string;
}> {
  console.log(`\n⚙️  Configuring ${provider.displayName}\n`);

  // Check if API key exists in environment
  const existingApiKey = provider.envKeyName
    ? process.env[provider.envKeyName]
    : undefined;

  let apiKey = '';
  if (existingApiKey) {
    console.log(`✓ API key found in environment variable ${provider.envKeyName}`);
    const useExisting = await question(
      rl,
      'Use existing API key? (Y/n): ',
    );
    if (useExisting.toLowerCase() !== 'n') {
      apiKey = existingApiKey;
    }
  }

  if (!apiKey) {
    apiKey = await questionPassword(
      rl,
      `Enter your ${provider.displayName} API key: `,
    );
    if (!apiKey) {
      throw new Error('API key is required');
    }
  }

  // Base URL configuration
  const existingBaseUrl = provider.envBaseUrlName
    ? process.env[provider.envBaseUrlName]
    : undefined;
  
  let baseUrl = existingBaseUrl || provider.defaultBaseUrl || '';
  const customizeBaseUrl = await question(
    rl,
    `Use custom base URL? Current: ${baseUrl} (y/N): `,
  );
  
  if (customizeBaseUrl.toLowerCase() === 'y') {
    const newBaseUrl = await question(
      rl,
      `Enter base URL (default: ${provider.defaultBaseUrl}): `,
    );
    if (newBaseUrl) {
      baseUrl = newBaseUrl;
    }
  }

  // Model configuration
  const existingModel = provider.envModelName
    ? process.env[provider.envModelName]
    : undefined;
  
  let model = existingModel || provider.defaultModel;
  const customizeModel = await question(
    rl,
    `Use custom model? Current: ${model} (y/N): `,
  );
  
  if (customizeModel.toLowerCase() === 'y') {
    const newModel = await question(
      rl,
      `Enter model name (default: ${provider.defaultModel}): `,
    );
    if (newModel) {
      model = newModel;
    }
  }

  return { apiKey, baseUrl, model };
}

async function testConfiguration(
  provider: ProviderConfig,
  config: { apiKey: string; baseUrl: string; model: string },
): Promise<boolean> {
  console.log('\n🔍 Testing configuration...\n');

  try {
    // Set environment variables temporarily for testing
    if (provider.envKeyName) {
      process.env[provider.envKeyName] = config.apiKey;
    }
    if (provider.envBaseUrlName && config.baseUrl) {
      process.env[provider.envBaseUrlName] = config.baseUrl;
    }
    if (provider.envModelName && config.model) {
      process.env[provider.envModelName] = config.model;
    }

    // Apply the configuration based on provider
    if (provider.authType === AuthType.USE_OPENAI) {
      setOpenAIApiKey(config.apiKey);
      setOpenAIBaseUrl(config.baseUrl);
      setOpenAIModel(config.model);
    } else if (provider.authType === AuthType.USE_BLACKBOX_API) {
      setBlackboxApiKey(config.apiKey);
      setBlackboxApiBaseUrl(config.baseUrl);
      setBlackboxApiModel(config.model);
    }

    console.log('✓ Configuration applied successfully');
    console.log('\n⚠️  Note: Full API validation will occur when you start using Blackbox CLI');
    
    return true;
  } catch (error) {
    console.error('❌ Configuration test failed:', error);
    return false;
  }
}

async function saveConfiguration(
  provider: ProviderConfig,
  config: { apiKey: string; baseUrl: string; model: string },
): Promise<void> {
  console.log('\n💾 Saving configuration...\n');

  const settings = loadSettings(process.cwd());

  // Save auth type
  settings.setValue(
    SettingScope.User,
    'security.auth.selectedType',
    provider.authType,
  );

  // Save model name
  settings.setValue(SettingScope.User, 'model.name', config.model);

  // Note: API keys are typically stored in environment variables or secure storage
  // For now, we'll just set them in the current process environment
  // Users should add them to their .env file or shell profile for persistence

  console.log('✓ Configuration saved to user settings');
  console.log('\n📝 Important: To persist your API key across sessions, add it to:');
  console.log(`   - Your shell profile (~/.bashrc, ~/.zshrc, etc.)`);
  console.log(`   - Or a .env file in your project directory`);
  console.log(`   - Or ~/.blackboxcli/.env`);
  console.log();
  console.log(`   Example:`);
  console.log(`   export ${provider.envKeyName}="${config.apiKey.substring(0, 8)}..."`);
  if (config.baseUrl !== provider.defaultBaseUrl) {
    console.log(`   export ${provider.envBaseUrlName}="${config.baseUrl}"`);
  }
  if (config.model !== provider.defaultModel) {
    console.log(`   export ${provider.envModelName}="${config.model}"`);
  }
}

async function runConfigure(): Promise<void> {
  console.log('\n🚀 Welcome to Blackbox CLI Configuration\n');
  console.log('This wizard will help you set up your AI provider and model.\n');

  const rl = createReadlineInterface();

  try {
    // Step 1: Select provider
    const provider = await selectProvider(rl);

    // Step 2: Configure provider (API key, base URL, model)
    const config = await configureProvider(provider, rl);

    // Step 3: Test configuration
    const testSuccess = await testConfiguration(provider, config);

    if (!testSuccess) {
      const continueAnyway = await question(
        rl,
        '\n⚠️  Configuration test had issues. Continue anyway? (y/N): ',
      );
      if (continueAnyway.toLowerCase() !== 'y') {
        console.log('\n❌ Configuration cancelled.\n');
        rl.close();
        process.exit(1);
      }
    }

    // Step 4: Save configuration
    await saveConfiguration(provider, config);

    console.log('\n✅ Configuration complete!\n');
    console.log('You can now run `blackbox` to start using the CLI.\n');
    console.log('💡 Tip: Run `blackbox configure` again anytime to update your settings.\n');

    rl.close();
  } catch (error) {
    console.error('\n❌ Configuration failed:', error);
    rl.close();
    process.exit(1);
  }
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
    await runConfigure();
    process.exit(0);
  },
};
