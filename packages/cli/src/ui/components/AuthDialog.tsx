/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type React from 'react';
import { useState } from 'react';
import { AuthType, type Config } from '@blackbox_ai/blackbox-cli-core';
import { Box, Text } from 'ink';
import {
  setBlackboxApiKey,
  setBlackboxApiBaseUrl,
  setBlackboxApiModel,
  setOpenAIApiKey,
  setOpenAIBaseUrl,
  setOpenAIModel,
  setOpenRouterApiKey,
  setOpenRouterBaseUrl,
  setOpenRouterModel,
  setCustomApiKey,
  setCustomBaseUrl,
  setCustomModel,
  setAnthropicApiKey,
  setAnthropicBaseUrl,
  setAnthropicModel,
  setGoogleApiKey,
  setGoogleBaseUrl,
  setGoogleModel,
  setXaiApiKey,
  setXaiBaseUrl,
  setXaiModel,
  saveProviderCredentials,
  loadProviderCredentialsFromSettings,
} from '../../config/auth.js';
import { type LoadedSettings, SettingScope } from '../../config/settings.js';
import { Colors } from '../colors.js';
import { useKeypress } from '../hooks/useKeypress.js';
import { GenericProviderKeyPrompt } from './GenericProviderKeyPrompt.js';
import { RadioButtonSelect } from './shared/RadioButtonSelect.js';

interface AuthDialogProps {
  onSelect: (authMethod: AuthType | undefined, scope: SettingScope, providerName?: string) => void;
  settings: LoadedSettings;
  initialErrorMessage?: string | null;
  config?: Config; // Config instance to update the model
}

interface ProviderConfig {
  name: string;
  displayName: string;
  authType: AuthType;
  defaultBaseUrl: string;
  defaultModel: string;
  envKeyName: string;
  requiresBaseUrl: boolean;
  apiKeyUrl: string;
  availableModels?: string[];
}

const PROVIDERS: ProviderConfig[] = [
  {
    name: 'blackbox',
    displayName: 'BlackboxAI',
    authType: AuthType.USE_BLACKBOX_API,
    defaultBaseUrl: 'https://api.blackbox.ai/v1',
    defaultModel: 'blackbox-ai',
    envKeyName: 'BLACKBOX_API_KEY',
    requiresBaseUrl: false,
    apiKeyUrl: 'https://www.blackbox.ai/',
    availableModels: [
      'blackboxai/anthropic/claude-3.5-sonnet',
      'blackboxai/anthropic/claude-3.7-sonnet',
      'blackboxai/anthropic/claude-sonnet-4',
      'blackboxai/anthropic/claude-sonnet-4.5',
      'blackboxai/anthropic/claude-opus-4',
      'blackboxai/deepseek/deepseek-chat',
      'blackboxai/deepseek/deepseek-chat:free',
      'blackboxai/google/gemini-2.5-flash',
      'blackboxai/google/gemini-2.5-pro',
      'blackboxai/mistralai/mistral-large',
      'blackboxai/openai/codex-mini',
      'blackboxai/openai/gpt-4.1',
      'blackboxai/openai/gpt-4.1-mini',
      'blackboxai/openai/gpt-4o',
      'blackboxai/openai/gpt-4o-mini',
      'blackboxai/openai/o4-mini',
      'blackboxai/openai/o3-mini',
    ],
  },
  {
    name: 'xai',
    displayName: 'xAI',
    authType: AuthType.USE_OPENAI,
    defaultBaseUrl: 'https://api.x.ai/v1',
    defaultModel: 'grok-code-fast-1',
    envKeyName: 'XAI_API_KEY',
    requiresBaseUrl: true,
    apiKeyUrl: 'https://console.x.ai/',
    availableModels: [
      'grok-code-fast-1',
      'grok-4-0709',
      'grok-3',
      'grok-3-fast',
      'grok-3-mini',
      'grok-3-mini-fast',
      'grok-2-vision-1212',
      'grok-2-image-1212',
      'grok-3-latest',
      'grok-3-fast-latest',
      'grok-3-mini-latest',
      'grok-3-mini-fast-latest',
      'grok-2-vision',
      'grok-2-vision-latest',
      'grok-2-image',
      'grok-2-image-latest',
      'grok-2',
      'grok-2-latest',
    ],
  },
  {
    name: 'google',
    displayName: 'Google Gemini',
    authType: AuthType.USE_OPENAI,
    defaultBaseUrl: 'https://generativelanguage.googleapis.com',
    defaultModel: 'gemini-2.5-flash',
    envKeyName: 'GOOGLE_API_KEY',
    requiresBaseUrl: true,
    apiKeyUrl: 'https://aistudio.google.com/apikey',
    availableModels: [
      'gemini-2.5-pro',
      'gemini-2.5-pro-preview-06-05',
      'gemini-2.5-pro-preview-05-06',
      'gemini-2.5-flash',
      'gemini-2.5-flash-preview-05-20',
      'gemini-2.5-flash-lite-preview-06-17',
      'gemini-2.0-flash',
      'gemini-2.0-flash-exp',
      'gemini-2.0-flash-lite',
      'gemini-1.5-flash',
      'gemini-1.5-flash-latest',
      'gemini-1.5-flash-002',
      'gemini-1.5-flash-8b',
      'gemini-1.5-flash-8b-latest',
      'gemini-1.5-pro',
      'gemini-1.5-pro-latest',
      'gemini-1.5-pro-002',
    ],
  },
  {
    name: 'anthropic',
    displayName: 'Anthropic',
    authType: AuthType.USE_OPENAI,
    defaultBaseUrl: 'https://api.anthropic.com/v1',
    defaultModel: 'claude-3-5-sonnet-latest',
    envKeyName: 'ANTHROPIC_API_KEY',
    requiresBaseUrl: true,
    apiKeyUrl: 'https://console.anthropic.com/',
    availableModels: [
      'claude-sonnet-4-latest',
      'claude-sonnet-4-20250514',
      'claude-opus-4-latest',
      'claude-opus-4-20250514',
      'claude-3-7-sonnet-latest',
      'claude-3-7-sonnet-20250219',
      'claude-3-5-sonnet-latest',
      'claude-3-5-sonnet-20241022',
      'claude-3-5-haiku-latest',
      'claude-3-5-haiku-20241022',
      'claude-3-opus-latest',
      'claude-3-opus-20240229',
      'claude-3-sonnet-20240229',
      'claude-3-haiku-20240307',
    ],
  },
  {
    name: 'openai',
    displayName: 'OpenAI',
    authType: AuthType.USE_OPENAI,
    defaultBaseUrl: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o-mini',
    envKeyName: 'OPENAI_API_KEY',
    requiresBaseUrl: true,
    apiKeyUrl: 'https://platform.openai.com/api-keys',
    availableModels: [
      'gpt-4',
      'gpt-4-turbo',
      'gpt-4o',
      'gpt-4o-mini',
      'gpt-3.5-turbo',
      'o1',
      'o1-mini',
      'o1-preview',
    ],
  },
  {
    name: 'openrouter',
    displayName: 'OpenRouter',
    authType: AuthType.USE_OPENAI,
    defaultBaseUrl: 'https://openrouter.ai/api/v1',
    defaultModel: 'anthropic/claude-3.5-sonnet',
    envKeyName: 'OPENROUTER_API_KEY',
    requiresBaseUrl: true,
    apiKeyUrl: 'https://openrouter.ai/keys',
    availableModels: [
      'anthropic/claude-3.5-sonnet',
      'anthropic/claude-3.7-sonnet',
      'anthropic/claude-sonnet-4',
      'google/gemini-2.5-pro',
      'deepseek/deepseek-r1-0528',
      'openai/gpt-4o',
      'openai/gpt-4-turbo',
      'meta-llama/llama-3.3-70b-instruct',
    ],
  },
  {
    name: 'custom',
    displayName: 'Custom Provider',
    authType: AuthType.USE_OPENAI,
    defaultBaseUrl: '',
    defaultModel: '',
    envKeyName: 'CUSTOM_API_KEY',
    requiresBaseUrl: true,
    apiKeyUrl: '',
    availableModels: [],
  },
];

function parseDefaultAuthType(
  defaultAuthType: string | undefined,
): AuthType | null {
  if (
    defaultAuthType &&
    Object.values(AuthType).includes(defaultAuthType as AuthType)
  ) {
    return defaultAuthType as AuthType;
  }
  return null;
}

export function AuthDialog({
  onSelect,
  settings,
  initialErrorMessage,
  config,
}: AuthDialogProps): React.JSX.Element {
  const [errorMessage, setErrorMessage] = useState<string | null>(
    initialErrorMessage || null,
  );
  const [showProviderKeyPrompt, setShowProviderKeyPrompt] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<ProviderConfig | null>(null);

  const items = PROVIDERS.map((provider) => ({
    label: provider.displayName,
    value: provider.name,
  }));

  const initialAuthIndex = Math.max(
    0,
    items.findIndex((item) => {
      const provider = PROVIDERS.find((p) => p.name === item.value);
      if (!provider) return false;

      // Check if this provider matches the selected provider in settings
      const selectedProviderName = settings.merged.security?.auth?.selectedProvider;
      if (selectedProviderName && selectedProviderName === provider.name) {
        return true;
      }

      // Fallback to checking selectedType for backward compatibility
      if (settings.merged.security?.auth?.selectedType) {
        return provider.authType === settings.merged.security?.auth?.selectedType;
      }

      const defaultAuthType = parseDefaultAuthType(
        process.env['BLACKBOX_DEFAULT_AUTH_TYPE'],
      );
      if (defaultAuthType) {
        return provider.authType === defaultAuthType;
      }

      if (process.env['GEMINI_API_KEY']) {
        return provider.authType === AuthType.USE_GEMINI;
      }

      return provider.authType === AuthType.LOGIN_WITH_GOOGLE;
    }),
  );

  const handleAuthSelect = (providerName: string) => {
    const provider = PROVIDERS.find((p) => p.name === providerName);
    if (!provider) return;

    // Always show the configuration prompt to allow users to change API key or model
    // even if the provider is already configured
    setSelectedProvider(provider);
    setShowProviderKeyPrompt(true);
    setErrorMessage(null);
  };

  const handleProviderKeySubmit = async (
    apiKey: string,
    baseUrl: string,
    model: string,
  ) => {
    if (!selectedProvider) return;

    // Set environment variables based on provider
    if (selectedProvider.name === 'openrouter') {
      setOpenRouterApiKey(apiKey);
      setOpenRouterBaseUrl(baseUrl);
      setOpenRouterModel(model);
      saveProviderCredentials(settings, 'openrouter', {
        apiKey,
        baseUrl,
        model,
      });
    } else if (selectedProvider.name === 'openai') {
      setOpenAIApiKey(apiKey);
      setOpenAIBaseUrl(baseUrl);
      setOpenAIModel(model);
      saveProviderCredentials(settings, 'openai', {
        apiKey,
        baseUrl,
        model,
      });
    } else if (selectedProvider.name === 'blackbox') {
      setBlackboxApiKey(apiKey);
      setBlackboxApiBaseUrl(baseUrl);
      setBlackboxApiModel(model);
      saveProviderCredentials(settings, 'blackbox', {
        apiKey,
        baseUrl,
        model,
      });
    } else if (selectedProvider.name === 'xai') {
      setXaiApiKey(apiKey);
      setXaiBaseUrl(baseUrl);
      setXaiModel(model);
      saveProviderCredentials(settings, 'xai', {
        apiKey,
        baseUrl,
        model,
      });
    } else if (selectedProvider.name === 'google') {
      setGoogleApiKey(apiKey);
      setGoogleBaseUrl(baseUrl);
      setGoogleModel(model);
      saveProviderCredentials(settings, 'google', {
        apiKey,
        baseUrl,
        model,
      });
    } else if (selectedProvider.name === 'anthropic') {
      setAnthropicApiKey(apiKey);
      setAnthropicBaseUrl(baseUrl);
      setAnthropicModel(model);
      saveProviderCredentials(settings, 'anthropic', {
        apiKey,
        baseUrl,
        model,
      });
    } else if (selectedProvider.name === 'custom') {
      setCustomApiKey(apiKey);
      setCustomBaseUrl(baseUrl);
      setCustomModel(model);
      saveProviderCredentials(settings, 'custom', {
        apiKey,
        baseUrl,
        model,
      });
    }

    // Save provider selection and model
    settings.setValue(
      SettingScope.User,
      'security.auth.selectedType',
      selectedProvider.authType,
    );
    settings.setValue(
      SettingScope.User,
      'security.auth.selectedProvider',
      selectedProvider.name,
    );
    settings.setValue(SettingScope.User, 'model.name', model);

    // Clear the OPENAI_MODEL environment variable to ensure the new provider's model is used
    // This is important because loadProviderCredentialsFromSettings only sets OPENAI_MODEL
    // if it's not already set, so we need to clear it first
    delete process.env['OPENAI_MODEL'];
    delete process.env['OPENAI_BASE_URL'];
    delete process.env['OPENAI_API_KEY'];
    
    // Reload credentials from settings to ensure environment variables are set correctly
    // This is important because some providers (xAI, Google, Anthropic, etc.) map their
    // specific API keys to OPENAI_API_KEY for compatibility
    loadProviderCredentialsFromSettings(settings);

    // Update the config model if config is provided
    // This ensures the model is synced immediately BEFORE refreshAuth is called
    if (config && typeof config.setModel === 'function') {
      try {
        await config.setModel(model, {
          reason: 'manual',
          context: 'auth_dialog_provider_change',
        });
      } catch (error) {
        console.error('Failed to update model in config:', error);
      }
    }

    // Clear any previous auth error since we just set new credentials
    setErrorMessage(null);
    
    setShowProviderKeyPrompt(false);
    const providerName = selectedProvider.name;
    setSelectedProvider(null);
    
    // Pass the provider name to the onSelect callback so it can handle MCP server setup
    onSelect(selectedProvider.authType, SettingScope.User, providerName);
  };

  const handleProviderKeyCancel = () => {
    setShowProviderKeyPrompt(false);
    setSelectedProvider(null);
    setErrorMessage(
      `${selectedProvider?.displayName || 'Provider'} API key is required to use ${selectedProvider?.displayName || 'this provider'} authentication.`,
    );
  };

  useKeypress(
    (key) => {
      if (showProviderKeyPrompt) {
        return;
      }

      if (key.name === 'escape') {
        // Prevent exit if there is an error message.
        // This means they user is not authenticated yet.
        if (errorMessage) {
          return;
        }
        if (settings.merged.security?.auth?.selectedType === undefined) {
          // Prevent exiting if no auth method is set
          setErrorMessage(
            'You must select an auth method to proceed. Press Ctrl+C again to exit.',
          );
          return;
        }
        onSelect(undefined, SettingScope.User);
      }
    },
    { isActive: true },
  );

  if (showProviderKeyPrompt && selectedProvider) {
    return (
      <GenericProviderKeyPrompt
        provider={selectedProvider}
        onSubmit={handleProviderKeySubmit}
        onCancel={handleProviderKeyCancel}
      />
    );
  }

  return (
    <Box
      borderStyle="round"
      borderColor={Colors.Gray}
      flexDirection="column"
      padding={1}
      width="100%"
    >
      <Text bold>Get started</Text>
      <Box marginTop={1}>
        <Text>How would you like to authenticate for this project?</Text>
      </Box>
      <Box marginTop={1}>
        <RadioButtonSelect
          items={items}
          initialIndex={initialAuthIndex}
          onSelect={handleAuthSelect}
        />
      </Box>
      {errorMessage && (
        <Box marginTop={1}>
          <Text color={Colors.AccentRed}>{errorMessage}</Text>
        </Box>
      )}
      <Box marginTop={1}>
        <Text color={Colors.AccentPurple}>(Use Enter to Set Auth)</Text>
      </Box>
      <Box marginTop={1}>
        <Text>Terms of Services and Privacy Notice for BlackboxAI</Text>
      </Box>
      <Box marginTop={1}>
        <Text color={Colors.AccentBlue}>
          {'https://www.blackbox.ai/terms'}
        </Text>
      </Box>
    </Box>
  );
}
