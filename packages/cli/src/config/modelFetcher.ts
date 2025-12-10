/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { getBlackboxApiModels, type BlackboxApiModel } from '@blackbox_ai/blackbox-cli-core';

/**
 * Fetch supported models from OpenRouter API (only models with tool support)
 */
export async function fetchOpenRouterModels(
  apiKey: string,
  baseUrl: string,
): Promise<string[]> {
  try {
    // Construct the models endpoint URL
    const modelsUrl = new URL('/api/v1/models', baseUrl).toString();

    console.log('[OpenRouter] Fetching models from:', modelsUrl);

    // Handle request failures gracefully
    let response;
    try {
      response = await fetch(modelsUrl, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'HTTP-Referer': 'https://github.com/llmcod/blackbox_cli.git',
          'X-Title': 'Blackbox Code',
          'Content-Type': 'application/json',
        },
      });
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : String(e);
      console.warn(
        `[OpenRouter] Failed to fetch models from API: ${errorMsg}, falling back to manual model entry`,
      );
      return [];
    }

    console.log('[OpenRouter] Response status:', response.status, response.statusText);

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unable to read error response');
      console.warn(
        `[OpenRouter] API returned error status ${response.status}: ${errorText}, falling back to manual model entry`,
      );
      return [];
    }

    // Handle JSON parsing failures gracefully
    let json;
    try {
      json = await response.json();
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : String(e);
      console.warn(
        `[OpenRouter] Failed to parse API response as JSON: ${errorMsg}, falling back to manual model entry`,
      );
      return [];
    }

    // Check for error in response
    if (json.error) {
      const errorMsg = json.error.message || 'unknown error';
      console.warn(`[OpenRouter] API returned an error: ${errorMsg}`);
      return [];
    }

    const data = json.data;
    if (!Array.isArray(data)) {
      console.warn(
        '[OpenRouter] Missing data field in JSON response, falling back to manual model entry',
      );
      return [];
    }

    console.log('[OpenRouter] Total models in response:', data.length);

    // Filter models that support tools
    interface OpenRouterModel {
      id: string;
      name?: string;
      supported_parameters?: string[];
    }

    const modelsWithTools = data.filter((model: OpenRouterModel) => {
      // Get the model ID
      const id = model.id;
      if (!id) {
        return false;
      }

      // Check if the model supports tools
      const supportedParams = model.supported_parameters;
      if (!Array.isArray(supportedParams)) {
        // If supported_parameters is missing, skip this model (assume no tool support)
        console.debug(
          `[OpenRouter] Model '${id}' missing supported_parameters field, skipping`,
        );
        return false;
      }

      const hasToolSupport = supportedParams.includes('tools');
      return hasToolSupport;
    });

    console.log('[OpenRouter] Models with tool support:', modelsWithTools.length);

    const modelIds = modelsWithTools
      .map((model: OpenRouterModel) => model.id)
      .filter((id: string) => typeof id === 'string' && id.length > 0);

    // If no models with tool support were found, fall back to manual entry
    if (modelIds.length === 0) {
      console.warn(
        '[OpenRouter] No models with tool support found in API response, falling back to manual model entry',
      );
      return [];
    }

    const sortedModels = modelIds.sort();

    console.log(
      '[OpenRouter] Successfully fetched',
      sortedModels.length,
      'models with tool support',
    );
    if (sortedModels.length > 0) {
      console.log('[OpenRouter] First 5 models:', sortedModels.slice(0, 5));
    }

    return sortedModels;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.warn(
      `[OpenRouter] Unexpected error fetching models: ${errorMsg}, falling back to manual model entry`,
    );
    return [];
  }
}

/**
 * Fetch supported models from OpenAI API
 */
export async function fetchOpenAIModels(
  apiKey: string,
  baseUrl: string,
): Promise<string[]> {
  try {
    // Construct the models endpoint URL
    const modelsUrl = new URL('/v1/models', baseUrl).toString();

    console.log('[OpenAI] Fetching models from:', modelsUrl);

    // Handle request failures gracefully
    let response;
    try {
      response = await fetch(modelsUrl, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      });
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : String(e);
      console.warn(
        `[OpenAI] Failed to fetch models from API: ${errorMsg}, falling back to manual model entry`,
      );
      return [];
    }

    console.log('[OpenAI] Response status:', response.status, response.statusText);

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unable to read error response');
      console.warn(
        `[OpenAI] API returned error status ${response.status}: ${errorText}, falling back to manual model entry`,
      );
      return [];
    }

    // Handle JSON parsing failures gracefully
    let json;
    try {
      json = await response.json();
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : String(e);
      console.warn(
        `[OpenAI] Failed to parse API response as JSON: ${errorMsg}, falling back to manual model entry`,
      );
      return [];
    }

    // Check for error in response
    if (json.error) {
      const errorMsg =
        json.error.message || json.error.code || 'unknown error';
      console.warn(`[OpenAI] API returned an error: ${errorMsg}`);
      return [];
    }

    const data = json.data;
    if (!Array.isArray(data)) {
      console.warn(
        '[OpenAI] Missing data field in JSON response, falling back to manual model entry',
      );
      return [];
    }

    console.log('[OpenAI] Total models in response:', data.length);

    // Extract model IDs
    interface OpenAIModel {
      id: string;
      object?: string;
      created?: number;
      owned_by?: string;
    }

    const modelIds = data
      .map((model: OpenAIModel) => model.id)
      .filter((id: string) => typeof id === 'string' && id.length > 0);

    if (modelIds.length === 0) {
      console.warn(
        '[OpenAI] No models found in API response, falling back to manual model entry',
      );
      return [];
    }

    const sortedModels = modelIds.sort();

    console.log('[OpenAI] Successfully fetched', sortedModels.length, 'models');
    if (sortedModels.length > 0) {
      console.log('[OpenAI] First 5 models:', sortedModels.slice(0, 5));
    }

    return sortedModels;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.warn(
      `[OpenAI] Unexpected error fetching models: ${errorMsg}, falling back to manual model entry`,
    );
    return [];
  }
}

/**
 * Fetch supported models from Blackbox API
 */
export async function fetchBlackboxModels(apiKey: string): Promise<string[]> {
  try {
    console.log('[Blackbox] Fetching models from API...');

    // Use the existing getBlackboxApiModels function from core
    const models = await getBlackboxApiModels(apiKey, true); // Force refresh

    if (!models || models.length === 0) {
      console.warn(
        '[Blackbox] No models returned from API, falling back to manual model entry',
      );
      return [];
    }

    // Extract model IDs (already sorted by getBlackboxApiModels)
    const modelIds = models
      .map((model: BlackboxApiModel) => model.id)
      .filter((id: string) => typeof id === 'string' && id.length > 0);

    if (modelIds.length === 0) {
      console.warn(
        '[Blackbox] No valid model IDs found, falling back to manual model entry',
      );
      return [];
    }

    // Don't sort here - models are already sorted by priority in getBlackboxApiModels
    console.log('[Blackbox] Successfully fetched', modelIds.length, 'models');
    if (modelIds.length > 0) {
      console.log('[Blackbox] First 5 models:', modelIds.slice(0, 5));
    }

    return modelIds;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.warn(
      `[Blackbox] Unexpected error fetching models: ${errorMsg}, falling back to manual model entry`,
    );
    return [];
  }
}

/**
 * Fetch models for any provider
 */
export async function fetchModelsForProvider(
  providerName: string,
  apiKey: string,
  baseUrl: string,
): Promise<string[]> {
  switch (providerName) {
    case 'openrouter':
      return fetchOpenRouterModels(apiKey, baseUrl);
    case 'openai':
      return fetchOpenAIModels(apiKey, baseUrl);
    case 'blackbox':
      return fetchBlackboxModels(apiKey);
    // All other providers use OpenAI-compatible API
    case 'xai':
    case 'google':
    case 'anthropic':
    case 'custom':
      return fetchOpenAIModels(apiKey, baseUrl);
    default:
      console.warn(`[ModelFetcher] Unknown provider: ${providerName}`);
      return [];
  }
}
