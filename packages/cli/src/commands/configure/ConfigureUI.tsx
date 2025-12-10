/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type React from 'react';
import { useState, useEffect } from 'react';
import { Box, Text, useApp } from 'ink';
import { AuthType } from '@blackbox_ai/blackbox-cli-core';
import { Colors } from '../../ui/colors.js';
import { RadioButtonSelect } from '../../ui/components/shared/RadioButtonSelect.js';
import { TextInput } from '../../ui/components/shared/TextInput.js';
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
} from '../../config/auth.js';
import { loadSettings, SettingScope } from '../../config/settings.js';
import { fetchModelsForProvider } from '../../config/modelFetcher.js';

interface ProviderConfig {
  name: string;
  displayName: string;
  authType: AuthType;
  requiresApiKey: boolean;
  defaultBaseUrl: string;
  defaultModel: string;
  envKeyName: string;
  envBaseUrlName: string;
  envModelName: string;
  availableModels: string[];
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
    availableModels: [
      'blackboxai/anthropic/claude-sonnet-4.5',
      'blackboxai/anthropic/claude-sonnet-4',
      'blackboxai/anthropic/claude-opus-4',
      'blackboxai/anthropic/claude-3.7-sonnet:thinking',
      'blackboxai/anthropic/claude-haiku-4.5',
      'blackboxai/anthropic/claude-3.5-sonnet',
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
      'blackboxai/openai/o3-mini'
    ],
  },
  {
    name: 'xai',
    displayName: 'xAI',
    authType: AuthType.USE_OPENAI, // xAI uses OpenAI-compatible API
    requiresApiKey: true,
    defaultBaseUrl: 'https://api.x.ai/v1',
    defaultModel: 'grok-code-fast-1',
    envKeyName: 'XAI_API_KEY',
    envBaseUrlName: 'XAI_HOST',
    envModelName: 'XAI_MODEL',
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
    authType: AuthType.USE_OPENAI, // Google uses OpenAI-compatible API
    requiresApiKey: true,
    defaultBaseUrl: 'https://generativelanguage.googleapis.com',
    defaultModel: 'gemini-2.5-flash',
    envKeyName: 'GOOGLE_API_KEY',
    envBaseUrlName: 'GOOGLE_HOST',
    envModelName: 'GOOGLE_MODEL',
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
    authType: AuthType.USE_OPENAI, // Anthropic uses OpenAI-compatible API
    requiresApiKey: true,
    defaultBaseUrl: 'https://api.anthropic.com/v1',
    defaultModel: 'claude-3-5-sonnet-latest',
    envKeyName: 'ANTHROPIC_API_KEY',
    envBaseUrlName: 'ANTHROPIC_BASE_URL',
    envModelName: 'ANTHROPIC_MODEL',
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
    requiresApiKey: true,
    defaultBaseUrl: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4',
    envKeyName: 'OPENAI_API_KEY',
    envBaseUrlName: 'OPENAI_BASE_URL',
    envModelName: 'OPENAI_MODEL',
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
    authType: AuthType.USE_OPENAI, // OpenRouter uses OpenAI-compatible API
    requiresApiKey: true,
    defaultBaseUrl: 'https://openrouter.ai/api/v1',
    defaultModel: 'anthropic/claude-3.5-sonnet',
    envKeyName: 'OPENROUTER_API_KEY',
    envBaseUrlName: 'OPENROUTER_BASE_URL',
    envModelName: 'OPENROUTER_MODEL',
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
    authType: AuthType.USE_OPENAI, // Custom provider uses OpenAI-compatible API
    requiresApiKey: true,
    defaultBaseUrl: '',
    defaultModel: '',
    envKeyName: 'CUSTOM_API_KEY',
    envBaseUrlName: 'CUSTOM_BASE_URL',
    envModelName: 'CUSTOM_MODEL',
    availableModels: [],
  },
];

type ConfigStep =
  | 'provider'
  | 'apiKey'
  | 'baseUrl'
  | 'model'
  | 'confirm'
  | 'complete';

interface ConfigureUIProps {
  onComplete: (providerName?: string) => void;
}

export function ConfigureUI({ onComplete }: ConfigureUIProps): React.JSX.Element {
  const { exit } = useApp();
  const [step, setStep] = useState<ConfigStep>('provider');
  const [selectedProvider, setSelectedProvider] = useState<ProviderConfig | null>(null);
  const [apiKey, setApiKey] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [model, setModel] = useState('');
  const [modelSearch, setModelSearch] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isFetchingModels, setIsFetchingModels] = useState(false);
  const [fetchedModels, setFetchedModels] = useState<string[]>([]);

  // Check for existing environment variables when provider is selected
  useEffect(() => {
    if (selectedProvider) {
      const existingApiKey = process.env[selectedProvider.envKeyName];
      const existingBaseUrl = process.env[selectedProvider.envBaseUrlName];
      const existingModel = process.env[selectedProvider.envModelName];

      if (existingApiKey) {
        setApiKey(existingApiKey);
      }
      if (existingBaseUrl) {
        setBaseUrl(existingBaseUrl);
      } else {
        setBaseUrl(selectedProvider.defaultBaseUrl);
      }
      if (existingModel) {
        setModel(existingModel);
      } else {
        setModel(selectedProvider.defaultModel);
      }
    }
  }, [selectedProvider]);

  // Fetch models when moving to model selection step
  useEffect(() => {
    if (step === 'model' && selectedProvider && apiKey && baseUrl) {
      const providerName = selectedProvider.name;
      console.log(`[${providerName}] Fetching models from API...`);
      setIsFetchingModels(true);
      setFetchedModels([]); // Clear previous models

      fetchModelsForProvider(providerName, apiKey, baseUrl)
        .then((models) => {
          console.log(`[${providerName}] Fetched ${models.length} models`);
          if (models.length > 0) {
            setFetchedModels(models);
            console.log(`[${providerName}] First 5 models:`, models.slice(0, 5));
          } else {
            console.log(`[${providerName}] No models fetched, using defaults`);
          }
        })
        .catch((error) => {
          console.error(`[${providerName}] Error fetching models:`, error);
        })
        .finally(() => {
          setIsFetchingModels(false);
        });
    }
  }, [step, selectedProvider, apiKey, baseUrl]);

  const handleProviderSelect = (providerName: string) => {
    const provider = PROVIDERS.find((p) => p.name === providerName);
    if (provider) {
      setSelectedProvider(provider);
      setStep('apiKey');
    }
  };

  const handleApiKeySubmit = () => {
    if (!apiKey.trim()) {
      setError('API key is required');
      return;
    }
    setError(null);
    // Skip baseUrl step for non-custom providers (use default)
    if (selectedProvider?.name === 'custom') {
      setStep('baseUrl');
    } else {
      setStep('model');
    }
  };

  const handleBaseUrlSubmit = () => {
    if (!baseUrl.trim()) {
      setError('Base URL is required');
      return;
    }
    setError(null);
    setStep('model');
  };

  const handleModelSelect = (selectedModel: string) => {
    setModel(selectedModel);
    setStep('confirm');
  };

  // Filter models based on search
  // Use fetched models if available, otherwise use default list
  const availableModels = selectedProvider
    ? fetchedModels.length > 0
      ? fetchedModels
      : selectedProvider.availableModels
    : [];

  const filteredModels = availableModels.filter((m) =>
    m.toLowerCase().includes(modelSearch.toLowerCase()),
  );

  const handleModelSearchSubmit = () => {
    // Only submit if there are no filtered results (custom model entry)
    // If there are filtered results, the RadioButtonSelect should handle selection
    if (filteredModels.length > 0) {
      return; // Don't submit, let RadioButtonSelect handle it
    }
    
    if (!modelSearch.trim()) {
      setError('Model name is required');
      return;
    }
    setModel(modelSearch);
    setStep('confirm');
  };

  const handleConfirm = async () => {
    if (!selectedProvider) return;

    try {
      // Load settings first
      const settings = loadSettings(process.cwd());

      // Apply configuration based on provider name (not authType, since OpenRouter uses USE_OPENAI)
      if (selectedProvider.name === 'openrouter') {
        // Set environment variables for immediate use
        setOpenRouterApiKey(apiKey);
        setOpenRouterBaseUrl(baseUrl);
        setOpenRouterModel(model);
        
        // Save to settings for persistence
        saveProviderCredentials(settings, 'openrouter', {
          apiKey,
          baseUrl,
          model,
        });
      } else if (selectedProvider.name === 'openai') {
        // Set environment variables for immediate use
        setOpenAIApiKey(apiKey);
        setOpenAIBaseUrl(baseUrl);
        setOpenAIModel(model);
        
        // Save to settings for persistence
        saveProviderCredentials(settings, 'openai', {
          apiKey,
          baseUrl,
          model,
        });
      } else if (selectedProvider.name === 'blackbox') {
        // Set environment variables for immediate use
        setBlackboxApiKey(apiKey);
        setBlackboxApiBaseUrl(baseUrl);
        setBlackboxApiModel(model);
        
        // Save to settings for persistence
        saveProviderCredentials(settings, 'blackbox', {
          apiKey,
          baseUrl,
          model,
        });
      } else if (selectedProvider.name === 'xai') {
        // Set environment variables for immediate use
        setXaiApiKey(apiKey);
        setXaiBaseUrl(baseUrl);
        setXaiModel(model);
        
        // Save to settings for persistence
        saveProviderCredentials(settings, 'xai', {
          apiKey,
          baseUrl,
          model,
        });
      } else if (selectedProvider.name === 'google') {
        // Set environment variables for immediate use
        setGoogleApiKey(apiKey);
        setGoogleBaseUrl(baseUrl);
        setGoogleModel(model);
        
        // Save to settings for persistence
        saveProviderCredentials(settings, 'google', {
          apiKey,
          baseUrl,
          model,
        });
      } else if (selectedProvider.name === 'anthropic') {
        // Set environment variables for immediate use
        setAnthropicApiKey(apiKey);
        setAnthropicBaseUrl(baseUrl);
        setAnthropicModel(model);
        
        // Save to settings for persistence
        saveProviderCredentials(settings, 'anthropic', {
          apiKey,
          baseUrl,
          model,
        });
      } else if (selectedProvider.name === 'custom') {
        // Set environment variables for immediate use
        setCustomApiKey(apiKey);
        setCustomBaseUrl(baseUrl);
        setCustomModel(model);
        
        // Save to settings for persistence
        saveProviderCredentials(settings, 'custom', {
          apiKey,
          baseUrl,
          model,
        });
      }

      // Save provider selection and model name
      // For selectedType, we use authType for backward compatibility
      settings.setValue(
        SettingScope.User,
        'security.auth.selectedType',
        selectedProvider.authType,
      );
      // Save the actual provider name so we can distinguish between OpenAI and OpenRouter
      settings.setValue(
        SettingScope.User,
        'security.auth.selectedProvider',
        selectedProvider.name,
      );
      settings.setValue(SettingScope.User, 'model.name', model);

      setStep('complete');
      setTimeout(() => {
        onComplete(selectedProvider.name);
        exit();
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Configuration failed');
    }
  };


  return (
    <Box flexDirection="column" padding={1}>
      <Box marginBottom={1}>
        <Text bold color={Colors.AccentCyan}>
          🚀 Blackbox CLI Configuration
        </Text>
      </Box>

      {step === 'provider' && (
        <Box flexDirection="column">
          <Box marginBottom={1}>
            <Text>Select your AI provider:</Text>
          </Box>
          <RadioButtonSelect
            items={PROVIDERS.map((p) => ({
              label: p.displayName,
              value: p.name,
            }))}
            onSelect={handleProviderSelect}
            isFocused={true}
          />
          <Box marginTop={1}>
            <Text color={Colors.Gray}>
              Use ↑↓ arrows to navigate, Enter to select, Ctrl+C to cancel
            </Text>
          </Box>
        </Box>
      )}

      {step === 'apiKey' && selectedProvider && (
        <Box flexDirection="column">
          <Box marginBottom={1}>
            <Text>
              Configure <Text color={Colors.AccentGreen}>{selectedProvider.displayName}</Text>
            </Text>
          </Box>
          {process.env[selectedProvider.envKeyName] && (
            <Box marginBottom={1}>
              <Text color={Colors.AccentGreen}>
                ✓ API key found in environment variable {selectedProvider.envKeyName}
              </Text>
            </Box>
          )}
          <Box marginBottom={1}>
            <Text>Enter your API key (or press Enter to use existing):</Text>
          </Box>
          <TextInput
            value={apiKey}
            onChange={setApiKey}
            onSubmit={handleApiKeySubmit}
            placeholder="Enter API key..."
            isActive={true}
          />
          {error && (
            <Box marginTop={1}>
              <Text color={Colors.AccentRed}>❌ {error}</Text>
            </Box>
          )}
          <Box marginTop={1}>
            <Text color={Colors.Gray}>Press Enter to continue, Ctrl+C to cancel</Text>
          </Box>
        </Box>
      )}

      {step === 'baseUrl' && selectedProvider && (
        <Box flexDirection="column">
          <Box marginBottom={1}>
            <Text>Base URL (press Enter to use default):</Text>
          </Box>
          <TextInput
            value={baseUrl}
            onChange={setBaseUrl}
            onSubmit={handleBaseUrlSubmit}
            placeholder={selectedProvider.defaultBaseUrl}
            isActive={true}
          />
          {error && (
            <Box marginTop={1}>
              <Text color={Colors.AccentRed}>❌ {error}</Text>
            </Box>
          )}
          <Box marginTop={1}>
            <Text color={Colors.Gray}>Press Enter to continue, Ctrl+C to cancel</Text>
          </Box>
        </Box>
      )}

      {step === 'model' && selectedProvider && (
        <Box flexDirection="column">
          <Box marginBottom={1}>
            <Text>Select a model or search for a custom one:</Text>
          </Box>
          {isFetchingModels && (
            <Box marginBottom={1}>
              <Text color={Colors.AccentCyan}>
                ⏳ Fetching available models from {selectedProvider.displayName}...
              </Text>
            </Box>
          )}
          {!isFetchingModels && fetchedModels.length > 0 && (
            <Box marginBottom={1}>
              <Text color={Colors.AccentGreen}>
                ✓ Loaded {fetchedModels.length} models from {selectedProvider.displayName} API
              </Text>
            </Box>
          )}
          {!isFetchingModels && fetchedModels.length === 0 && (
            <Box marginBottom={1}>
              <Text color={Colors.AccentYellow}>
                ⚠ Could not fetch models from API, using default list
              </Text>
            </Box>
          )}
          <Box marginBottom={1}>
            <TextInput
              value={modelSearch}
              onChange={setModelSearch}
              onSubmit={handleModelSearchSubmit}
              placeholder="Search models or enter custom model name..."
              isActive={true}
            />
          </Box>
          {filteredModels.length > 0 && (
            <Box marginTop={1}>
              <RadioButtonSelect
                items={filteredModels.map((m) => ({
                  label: m,
                  value: m,
                }))}
                onSelect={handleModelSelect}
                isFocused={true}
                maxItemsToShow={8}
                showScrollArrows={true}
              />
            </Box>
          )}
          {modelSearch && filteredModels.length === 0 && (
            <Box marginTop={1}>
              <Text color={Colors.Gray}>
                  No matching models. Press Enter to use {modelSearch} as custom model.
              </Text>
            </Box>
          )}
          {error && (
            <Box marginTop={1}>
              <Text color={Colors.AccentRed}>❌ {error}</Text>
            </Box>
          )}
          <Box marginTop={1}>
            <Text color={Colors.Gray}>
              {filteredModels.length > 0
                ? 'Type to filter, use ↑↓ to navigate, Enter to select, Ctrl+C to cancel'
                : 'Type model name and press Enter to use custom model, Ctrl+C to cancel'}
            </Text>
          </Box>
        </Box>
      )}

      {step === 'confirm' && selectedProvider && (
        <Box flexDirection="column">
          <Box marginBottom={1}>
            <Text bold>Review your configuration:</Text>
          </Box>
          <Box marginBottom={1}>
            <Text>
              Provider: <Text color={Colors.AccentGreen}>{selectedProvider.displayName}</Text>
            </Text>
          </Box>
          <Box marginBottom={1}>
            <Text>
              API Key: <Text color={Colors.AccentGreen}>{apiKey.substring(0, 8)}...</Text>
            </Text>
          </Box>
          <Box marginBottom={1}>
            <Text>
              Base URL: <Text color={Colors.AccentGreen}>{baseUrl}</Text>
            </Text>
          </Box>
          <Box marginBottom={1}>
            <Text>
              Model: <Text color={Colors.AccentGreen}>{model}</Text>
            </Text>
          </Box>
          <Box marginTop={1} marginBottom={1}>
            <Text>Press Enter to save, Ctrl+C to cancel</Text>
          </Box>
          <TextInput
            value=""
            onChange={() => {}}
            onSubmit={handleConfirm}
            placeholder="Press Enter to confirm..."
            isActive={true}
          />
        </Box>
      )}

      {step === 'complete' && selectedProvider && (
        <Box flexDirection="column">
          <Box marginBottom={1}>
            <Text color={Colors.AccentGreen}>✅ Configuration saved successfully!</Text>
          </Box>
          <Box marginBottom={1}>
            <Text>
              Provider: <Text color={Colors.AccentGreen}>{selectedProvider.displayName}</Text>
            </Text>
          </Box>
          <Box marginBottom={1}>
            <Text>
              Model: <Text color={Colors.AccentGreen}>{model}</Text>
            </Text>
          </Box>
          <Box marginTop={1}>
            <Text color={Colors.AccentYellow}>
              📝 To persist your API key across sessions, add it to:
            </Text>
          </Box>
          <Box marginLeft={2}>
            <Text color={Colors.Gray}>
              • Your shell profile (~/.bashrc, ~/.zshrc, etc.)
            </Text>
          </Box>
          <Box marginLeft={2}>
            <Text color={Colors.Gray}>• Or ~/.blackboxcli/.env</Text>
          </Box>
          <Box marginTop={1} marginLeft={2}>
            <Text color={Colors.Gray}>
              export {selectedProvider.envKeyName}=&apos;{apiKey.substring(0, 8)}...&apos;
            </Text>
          </Box>
          <Box marginTop={1}>
            <Text color={Colors.AccentCyan}>
              💡 Run &apos;blackbox&apos; to start using the CLI!
            </Text>
          </Box>
        </Box>
      )}
    </Box>
  );
}
