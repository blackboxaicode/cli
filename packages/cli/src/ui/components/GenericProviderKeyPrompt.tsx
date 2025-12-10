/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type React from 'react';
import { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import { Colors } from '../colors.js';
import { TextInput } from './shared/TextInput.js';
import { RadioButtonSelect } from './shared/RadioButtonSelect.js';
import { fetchModelsForProvider } from '../../config/modelFetcher.js';

interface ProviderConfig {
  name: string;
  displayName: string;
  defaultBaseUrl: string;
  defaultModel: string;
  requiresBaseUrl: boolean;
  apiKeyUrl: string;
  availableModels?: string[];
}

interface GenericProviderKeyPromptProps {
  provider: ProviderConfig;
  onSubmit: (apiKey: string, baseUrl: string, model: string) => void;
  onCancel: () => void;
}

type PromptStep = 'apiKey' | 'baseUrl' | 'model';

export function GenericProviderKeyPrompt({
  provider,
  onSubmit,
  onCancel,
}: GenericProviderKeyPromptProps): React.JSX.Element | null {
  const [apiKey, setApiKey] = useState('');
  const [baseUrl] = useState(provider.defaultBaseUrl);
  const [modelSearch, setModelSearch] = useState('');
  const [currentStep, setCurrentStep] = useState<PromptStep>('apiKey');
  const [isFetchingModels, setIsFetchingModels] = useState(false);
  const [fetchedModels, setFetchedModels] = useState<string[]>([]);

  // Fetch models when moving to model selection step
  useEffect(() => {
    if (currentStep === 'model' && apiKey && baseUrl) {
      const providerName = provider.name;
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
  }, [currentStep, provider.name, apiKey, baseUrl]);

  const handleApiKeySubmit = () => {
    if (!apiKey.trim()) {
      return; // Don't proceed without API key
    }
    // Always skip base URL step and use default
    setCurrentStep('model');
  };

  const handleModelSelect = (selectedModel: string) => {
    onSubmit(apiKey.trim(), baseUrl.trim(), selectedModel);
  };

  const handleModelSearchSubmit = () => {
    // Only submit if there are no filtered results (custom model entry)
    if (filteredModels.length > 0) {
      return; // Don't submit, let RadioButtonSelect handle it
    }
    
    if (!modelSearch.trim()) {
      return; // Don't submit without a model
    }
    onSubmit(apiKey.trim(), baseUrl.trim(), modelSearch);
  };

  // Use fetched models if available, otherwise use default list
  const availableModels = fetchedModels.length > 0 
    ? fetchedModels 
    : (provider.availableModels || []);

  // Filter models based on search
  const filteredModels = availableModels.filter((m) =>
    m.toLowerCase().includes(modelSearch.toLowerCase()),
  );

  useInput((input, key) => {
    if (key.escape) {
      onCancel();
      return;
    }
  });

  if (currentStep === 'apiKey') {
    return (
      <Box
        borderStyle="round"
        borderColor={Colors.AccentBlue}
        flexDirection="column"
        padding={1}
        width="100%"
      >
        <Text bold color={Colors.AccentBlue}>
          {provider.displayName} Configuration Required
        </Text>
        <Box marginTop={1}>
          <Text>
            Please enter your {provider.displayName} API key.
            {provider.apiKeyUrl && (
              <>
                {' '}
                You can get an API key from{' '}
                <Text color={Colors.AccentBlue}>{provider.apiKeyUrl}</Text>
              </>
            )}
          </Text>
        </Box>
        <Box marginTop={1}>
          <Text>Enter your API key:</Text>
        </Box>
        <TextInput
          value={apiKey}
          onChange={setApiKey}
          onSubmit={handleApiKeySubmit}
          placeholder="Enter API key..."
          isActive={true}
        />
        <Box marginTop={1}>
          <Text color={Colors.Gray}>Press Enter to continue, Esc to cancel</Text>
        </Box>
      </Box>
    );
  }


  if (currentStep === 'model') {
    return (
      <Box
        borderStyle="round"
        borderColor={Colors.AccentBlue}
        flexDirection="column"
        padding={1}
        width="100%"
      >
        <Text bold color={Colors.AccentBlue}>
          {provider.displayName} Model Selection
        </Text>
        <Box marginTop={1}>
          <Text>Select a model or search for a custom one:</Text>
        </Box>
        {isFetchingModels && (
          <Box marginTop={1}>
            <Text color={Colors.AccentCyan}>
              ⏳ Fetching available models from {provider.displayName}...
            </Text>
          </Box>
        )}
        {!isFetchingModels && fetchedModels.length > 0 && (
          <Box marginTop={1}>
            <Text color={Colors.AccentGreen}>
              ✓ Loaded {fetchedModels.length} models from {provider.displayName} API
            </Text>
          </Box>
        )}
        {!isFetchingModels && fetchedModels.length === 0 && availableModels.length > 0 && (
          <Box marginTop={1}>
            <Text color={Colors.AccentYellow}>
              ⚠ Could not fetch models from API, using default list
            </Text>
          </Box>
        )}
        <Box marginTop={1}>
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
        {!modelSearch && availableModels.length === 0 && (
          <Box marginTop={1}>
            <Text color={Colors.Gray}>
              Enter a model name (default: {provider.defaultModel || 'none'})
            </Text>
          </Box>
        )}
        <Box marginTop={1}>
          <Text color={Colors.Gray}>
            {filteredModels.length > 0
              ? 'Type to filter, use ↑↓ to navigate, Enter to select, Esc to cancel'
              : 'Type model name and press Enter to use custom model, Esc to cancel'}
          </Text>
        </Box>
      </Box>
    );
  }

  return null;
}
