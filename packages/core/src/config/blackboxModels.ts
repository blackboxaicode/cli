/**
 * @license
 * Copyright 2025 BlackboxAI
 * SPDX-License-Identifier: Apache-2.0
 */

import { DEFAULT_BLACKBOX_API_MODEL } from './models.js';

export interface BlackboxApiModel {
  id: string;
  name: string;
  description?: string;
  contextLength?: number;
  inputCost?: number;
  outputCost?: number;
}

// Default models list (fallback when API is unavailable)
// Ordered with priority models first, then alphabetically
export const DEFAULT_BLACKBOX_API_MODELS: BlackboxApiModel[] = [
  {
    id: 'blackboxai/anthropic/claude-sonnet-4.5',
    name: 'Claude Sonnet 4.5',
    description: 'Anthropic Claude Sonnet 4.5 model',
  },
  {
    id: 'blackboxai/anthropic/claude-opus-4.5',
    name: 'Claude Opus 4.5',
    description: 'Anthropic Claude Opus 4.5 model',
  },
  {
    id: 'blackboxai/anthropic/claude-sonnet-4',
    name: 'Claude Sonnet 4',
    description: 'Anthropic Claude Sonnet 4 model',
  },
  {
    id: 'blackboxai/anthropic/claude-opus-4',
    name: 'Claude Opus 4',
    description: 'Anthropic Claude Opus 4 model',
  },
  {
    id: 'blackboxai/anthropic/claude-3.7-sonnet:thinking',
    name: 'Claude 3.7 Sonnet (Thinking)',
    description: 'Anthropic Claude 3.7 Sonnet with extended thinking',
  },
  {
    id: 'blackboxai/anthropic/claude-haiku-4.5',
    name: 'Claude Haiku 4.5',
    description: 'Anthropic Claude Haiku 4.5 model',
  },
  {
    id: 'blackboxai/anthropic/claude-3.5-sonnet',
    name: 'Claude 3.5 Sonnet',
    description: 'Anthropic Claude 3.5 Sonnet model',
  },
  {
    id: 'blackboxai/google/gemini-2.5-flash',
    name: 'Gemini 2.5 Flash',
    description: 'Google Gemini 2.5 Flash model',
  },
  {
    id: 'blackboxai/meta-llama/llama-3.3-70b-instruct',
    name: 'Llama 3.3 70B',
    description: 'Meta Llama 3.3 70B Instruct model',
  },
  {
    id: 'blackboxai/openai/gpt-4o',
    name: 'GPT-4o',
    description: 'OpenAI GPT-4o model',
  },
  {
    id: 'blackboxai/x-ai/grok-code-fast-1:free',
    name: 'Grok Code Fast (Free)',
    description: 'Fast coding model optimized for quick responses',
  },
];

interface ModelCache {
  models: BlackboxApiModel[];
  timestamp: number;
}

let modelCache: ModelCache | null = null;
const CACHE_DURATION_MS: number = 10 * 60 * 1000; // 10 minutes

/**
 * Formats model name from ID
 */
function formatModelName(id: string): string {
  // Extract the last part after the last slash
  const parts = id.split('/');
  const lastPart = parts[parts.length - 1];
  
  // Remove :free suffix if present
  const nameWithoutSuffix = lastPart.replace(':free', '');
  
  // Convert to title case and replace hyphens with spaces
  return nameWithoutSuffix
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Priority order for specific models
 */
const MODEL_PRIORITY_ORDER = [
  'blackboxai/anthropic/claude-sonnet-4.5',
  'blackboxai/anthropic/claude-opus-4.5',
  'blackboxai/anthropic/claude-sonnet-4',
  'blackboxai/anthropic/claude-opus-4',
  'blackboxai/anthropic/claude-3.7-sonnet:thinking',
  'blackboxai/anthropic/claude-haiku-4.5',
];

/**
 * Sorts models with priority models first, then alphabetically
 */
function sortModels(models: BlackboxApiModel[]): BlackboxApiModel[] {
  return models.sort((a, b) => {
    const priorityA = MODEL_PRIORITY_ORDER.indexOf(a.id);
    const priorityB = MODEL_PRIORITY_ORDER.indexOf(b.id);
    
    // If both models are in priority list, sort by priority order
    if (priorityA !== -1 && priorityB !== -1) {
      return priorityA - priorityB;
    }
    
    // If only a is in priority list, a comes first
    if (priorityA !== -1) {
      return -1;
    }
    
    // If only b is in priority list, b comes first
    if (priorityB !== -1) {
      return 1;
    }
    
    // Otherwise, sort alphabetically by id
    return a.id.localeCompare(b.id);
  });
}

/**
 * Fetches available models from BlackboxAI API
 */
async function fetchBlackboxApiModels(apiKey: string): Promise<BlackboxApiModel[]> {
  try {
    // Try the /model/info endpoint first for detailed information
    const infoResponse = await fetch('https://api.blackbox.ai/model/info', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
    });

    if (infoResponse.ok) {
      const infoData = await infoResponse.json();
      
      if (infoData.data && Array.isArray(infoData.data)) {
        const models = infoData.data.map((item: Record<string, unknown>) => {
          const modelInfo = (item['model_info'] || {}) as Record<string, unknown>;
          const sourceMetadata = (modelInfo['source_metadata'] || {}) as Record<string, unknown>;
          
          return {
            id: (item['model_name'] || modelInfo['key']) as string,
            name: (sourceMetadata['name'] || formatModelName((item['model_name'] || modelInfo['key']) as string)) as string,
            description: sourceMetadata['description'] as string | undefined,
            contextLength: (sourceMetadata['context_length'] || modelInfo['max_input_tokens']) as number | undefined,
            inputCost: modelInfo['input_cost_per_token'] as number | undefined,
            outputCost: modelInfo['output_cost_per_token'] as number | undefined,
          };
        });
        return sortModels(models);
      }
    }

    // Fallback to /models endpoint
    const response = await fetch('https://api.blackbox.ai/models', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
    });

    if (!response.ok) {
      console.warn(`Failed to fetch Blackbox models: ${response.status} ${response.statusText}`);
      return DEFAULT_BLACKBOX_API_MODELS;
    }

    const data = await response.json();
    
    // Parse the /models response format
    if (data.data && Array.isArray(data.data)) {
      const models = data.data.map((model: Record<string, unknown>) => ({
        id: model['id'] as string,
        name: formatModelName(model['id'] as string),
        description: undefined,
      }));
      return sortModels(models);
    }

    return DEFAULT_BLACKBOX_API_MODELS;
  } catch (error) {
    console.warn('Error fetching Blackbox models:', error);
    return DEFAULT_BLACKBOX_API_MODELS;
  }
}

/**
 * Gets available Blackbox models with caching
 * @param apiKey - Optional API key. If not provided, returns default models
 * @param forceRefresh - Force refresh the cache
 */
export async function getBlackboxApiModels(
  apiKey?: string,
  forceRefresh = false,
): Promise<BlackboxApiModel[]> {
  // If no API key, return default models
  if (!apiKey) {
    return DEFAULT_BLACKBOX_API_MODELS;
  }

  const now = Date.now();

  // Check if cache is valid
  if (
    !forceRefresh &&
    modelCache !== null &&
    now - modelCache.timestamp < CACHE_DURATION_MS
  ) {
    return modelCache.models;
  }

  // Fetch fresh models
  const models = await fetchBlackboxApiModels(apiKey);

  // Update cache
  modelCache = {
    models,
    timestamp: now,
  };

  return models;
}

/**
 * Gets the default Blackbox model
 */
export function getDefaultBlackboxApiModel(): string {
  return DEFAULT_BLACKBOX_API_MODEL;
}

/**
 * Clears the model cache
 */
export function clearBlackboxApiModelCache(): void {
  modelCache = null;
}
