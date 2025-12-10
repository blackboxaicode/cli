/**
 * @license
 * Copyright 2025 Blackbox
 * SPDX-License-Identifier: Apache-2.0
 */

import { AuthType } from '@blackbox_ai/blackbox-cli-core';
import type {
  SlashCommand,
  CommandContext,
  OpenDialogActionReturn,
  MessageActionReturn,
} from './types.js';
import { CommandKind } from './types.js';
import {
  AVAILABLE_MODELS_BLACKBOX,
  getBlackboxApiAvailableModelFromEnv,
  getOpenAIAvailableModelFromEnv,
  type AvailableModel,
} from '../models/availableModels.js';
import { fetchModelsForProvider } from '../../config/modelFetcher.js';

function getAvailableModelsForAuthType(authType: AuthType): AvailableModel[] {
  switch (authType) {
    case AuthType.BLACKBOX_OAUTH:
      return AVAILABLE_MODELS_BLACKBOX;
    case AuthType.USE_OPENAI: {
      // For USE_OPENAI, we'll fetch models dynamically in the action function
      // Return empty array here to indicate dynamic fetching is needed
      return [];
    }
    case AuthType.USE_BLACKBOX_API: {
      // For USE_BLACKBOX_API, we'll fetch models dynamically in the action function
      // Return empty array here to indicate dynamic fetching is needed
      return [];
    }
    default:
      // For other auth types, return empty array for now
      // This can be expanded later according to the design doc
      return [];
  }
}

async function getAvailableModelsForAuthTypeAsync(
  authType: AuthType,
  apiKey?: string,
): Promise<AvailableModel[]> {
  switch (authType) {
    case AuthType.BLACKBOX_OAUTH:
      return AVAILABLE_MODELS_BLACKBOX;
    case AuthType.USE_OPENAI:
    case AuthType.USE_BLACKBOX_API: {
      if (!apiKey) {
        // Fallback to env variable if no API key provided
        if (authType === AuthType.USE_BLACKBOX_API) {
          const blackboxApiModel = getBlackboxApiAvailableModelFromEnv();
          return blackboxApiModel ? [blackboxApiModel] : [];
        } else {
          const openAIModel = getOpenAIAvailableModelFromEnv();
          return openAIModel ? [openAIModel] : [];
        }
      }
      
      // Get provider name from settings (e.g., 'openai', 'openrouter', 'blackbox', 'xai', etc.)
      const providerName = process.env['SELECTED_PROVIDER'] || 
                          (authType === AuthType.USE_BLACKBOX_API ? 'blackbox' : 'openai');
      
      // Get baseUrl from config or use default
      const baseUrl = process.env['OPENAI_BASE_URL'] || 
                     process.env['BLACKBOX_API_BASE_URL'] ||
                     'https://api.openai.com';
      
      try {
        // Fetch models using the unified function
        const modelIds = await fetchModelsForProvider(providerName, apiKey, baseUrl);
        
        if (modelIds.length === 0) {
          // Fallback to env variable if fetch returns empty
          if (authType === AuthType.USE_BLACKBOX_API) {
            const blackboxApiModel = getBlackboxApiAvailableModelFromEnv();
            return blackboxApiModel ? [blackboxApiModel] : [];
          } else {
            const openAIModel = getOpenAIAvailableModelFromEnv();
            return openAIModel ? [openAIModel] : [];
          }
        }
        
        // Convert model IDs to AvailableModel format
        return modelIds.map((id) => ({
          id,
          label: id,
        }));
      } catch (error) {
        console.warn(`Failed to fetch models for ${providerName}:`, error);
        // Fallback to env variable on error
        if (authType === AuthType.USE_BLACKBOX_API) {
          const blackboxApiModel = getBlackboxApiAvailableModelFromEnv();
          return blackboxApiModel ? [blackboxApiModel] : [];
        } else {
          const openAIModel = getOpenAIAvailableModelFromEnv();
          return openAIModel ? [openAIModel] : [];
        }
      }
    }
    default:
      // For other auth types, return empty array for now
      // This can be expanded later according to the design doc
      return [];
  }
}

export const modelCommand: SlashCommand = {
  name: 'model',
  description: 'Switch the model for this session',
  kind: CommandKind.BUILT_IN,
  action: async (
    context: CommandContext,
  ): Promise<OpenDialogActionReturn | MessageActionReturn> => {
    const { services } = context;
    const { config } = services;

    if (!config) {
      return {
        type: 'message',
        messageType: 'error',
        content: 'Configuration not available.',
      };
    }

    const contentGeneratorConfig = config.getContentGeneratorConfig();
    if (!contentGeneratorConfig) {
      return {
        type: 'message',
        messageType: 'error',
        content: 'Content generator configuration not available.',
      };
    }

    const authType = contentGeneratorConfig.authType;
    if (!authType) {
      return {
        type: 'message',
        messageType: 'error',
        content: 'Authentication type not available.',
      };
    }

    // For USE_BLACKBOX_API and USE_OPENAI, fetch models dynamically
    let availableModels: AvailableModel[];
    if (authType === AuthType.USE_BLACKBOX_API || authType === AuthType.USE_OPENAI) {
      const apiKey = contentGeneratorConfig.apiKey;
      availableModels = await getAvailableModelsForAuthTypeAsync(authType, apiKey);
    } else {
      availableModels = getAvailableModelsForAuthType(authType);
    }

    if (availableModels.length === 0) {
      return {
        type: 'message',
        messageType: 'error',
        content: `No models available for the current authentication type (${authType}).`,
      };
    }

    // Trigger model selection dialog
    return {
      type: 'dialog',
      dialog: 'model',
    };
  },
};
