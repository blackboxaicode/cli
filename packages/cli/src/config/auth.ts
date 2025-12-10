/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { AuthType } from '@blackbox_ai/blackbox-cli-core';
import { loadEnvironment, type LoadedSettings, SettingScope } from './settings.js';

export const validateAuthMethod = (authMethod: string): string | null => {
  loadEnvironment();
  if (
    authMethod === AuthType.LOGIN_WITH_GOOGLE ||
    authMethod === AuthType.CLOUD_SHELL
  ) {
    return null;
  }

  if (authMethod === AuthType.USE_GEMINI) {
    if (!process.env['GEMINI_API_KEY']) {
      return 'GEMINI_API_KEY environment variable not found. Add that to your environment and try again (no reload needed if using .env)!';
    }
    return null;
  }

  if (authMethod === AuthType.USE_VERTEX_AI) {
    const hasVertexProjectLocationConfig =
      !!process.env['GOOGLE_CLOUD_PROJECT'] &&
      !!process.env['GOOGLE_CLOUD_LOCATION'];
    const hasGoogleApiKey = !!process.env['GOOGLE_API_KEY'];
    if (!hasVertexProjectLocationConfig && !hasGoogleApiKey) {
      return (
        'When using Vertex AI, you must specify either:\n' +
        '• GOOGLE_CLOUD_PROJECT and GOOGLE_CLOUD_LOCATION environment variables.\n' +
        '• GOOGLE_API_KEY environment variable (if using express mode).\n' +
        'Update your environment and try again (no reload needed if using .env)!'
      );
    }
    return null;
  }

  if (authMethod === AuthType.USE_OPENAI) {
    if (!process.env['OPENAI_API_KEY']) {
      return 'OPENAI_API_KEY environment variable not found. You can enter it interactively or add it to your .env file.';
    }
    return null;
  }

  if (authMethod === AuthType.BLACKBOX_OAUTH) {
    // Blackbox OAuth doesn't require any environment variables for basic setup
    // The OAuth flow will handle authentication
    return null;
  }

  if (authMethod === AuthType.USE_BLACKBOX_API) {
    if (!process.env['BLACKBOX_API_KEY']) {
      return 'BLACKBOX_API_KEY environment variable not found. You can enter it interactively or add it to your .env file.';
    }
    return null;
  }

  return 'Invalid auth method selected.';
};

export const setOpenAIApiKey = (apiKey: string): void => {
  process.env['OPENAI_API_KEY'] = apiKey;
};

export const setOpenAIBaseUrl = (baseUrl: string): void => {
  process.env['OPENAI_BASE_URL'] = baseUrl;
};

export const setOpenAIModel = (model: string): void => {
  process.env['OPENAI_MODEL'] = model;
};

export const setBlackboxApiKey = (apiKey: string): void => {
  process.env['BLACKBOX_API_KEY'] = apiKey;
};

export const setBlackboxApiBaseUrl = (baseUrl: string): void => {
  process.env['BLACKBOX_API_BASE_URL'] = baseUrl;
};

export const setBlackboxApiModel = (model: string): void => {
  process.env['BLACKBOX_API_MODEL'] = model;
};

export const setOpenRouterApiKey = (apiKey: string): void => {
  process.env['OPENROUTER_API_KEY'] = apiKey;
};

export const setOpenRouterBaseUrl = (baseUrl: string): void => {
  process.env['OPENROUTER_BASE_URL'] = baseUrl;
};

export const setOpenRouterModel = (model: string): void => {
  process.env['OPENROUTER_MODEL'] = model;
};

export const setCustomApiKey = (apiKey: string): void => {
  process.env['CUSTOM_API_KEY'] = apiKey;
};

export const setCustomBaseUrl = (baseUrl: string): void => {
  process.env['CUSTOM_BASE_URL'] = baseUrl;
};

export const setCustomModel = (model: string): void => {
  process.env['CUSTOM_MODEL'] = model;
};

export const setAnthropicApiKey = (apiKey: string): void => {
  process.env['ANTHROPIC_API_KEY'] = apiKey;
};

export const setAnthropicBaseUrl = (baseUrl: string): void => {
  process.env['ANTHROPIC_BASE_URL'] = baseUrl;
};

export const setAnthropicModel = (model: string): void => {
  process.env['ANTHROPIC_MODEL'] = model;
};

export const setGoogleApiKey = (apiKey: string): void => {
  process.env['GOOGLE_API_KEY'] = apiKey;
};

export const setGoogleBaseUrl = (baseUrl: string): void => {
  process.env['GOOGLE_HOST'] = baseUrl;
};

export const setGoogleModel = (model: string): void => {
  process.env['GOOGLE_MODEL'] = model;
};

export const setXaiApiKey = (apiKey: string): void => {
  process.env['XAI_API_KEY'] = apiKey;
};

export const setXaiBaseUrl = (baseUrl: string): void => {
  process.env['XAI_HOST'] = baseUrl;
};

export const setXaiModel = (model: string): void => {
  process.env['XAI_MODEL'] = model;
};

/**
 * Save provider credentials to settings file for persistence across sessions
 */
export const saveProviderCredentials = (
  settings: LoadedSettings,
  provider: 'openai' | 'blackbox' | 'openrouter' | 'custom' | 'anthropic' | 'google' | 'xai',
  credentials: {
    apiKey?: string;
    baseUrl?: string;
    model?: string;
  },
): void => {
  const { apiKey, baseUrl, model } = credentials;

  if (provider === 'openai') {
    if (apiKey) {
      settings.setValue(SettingScope.User, 'security.auth.openai.apiKey', apiKey);
    }
    if (baseUrl) {
      settings.setValue(SettingScope.User, 'security.auth.openai.baseUrl', baseUrl);
    }
    if (model) {
      settings.setValue(SettingScope.User, 'security.auth.openai.model', model);
    }
  } else if (provider === 'blackbox') {
    if (apiKey) {
      settings.setValue(SettingScope.User, 'security.auth.blackbox.apiKey', apiKey);
    }
    if (baseUrl) {
      settings.setValue(SettingScope.User, 'security.auth.blackbox.baseUrl', baseUrl);
    }
    if (model) {
      settings.setValue(SettingScope.User, 'security.auth.blackbox.model', model);
    }
  } else if (provider === 'openrouter') {
    if (apiKey) {
      settings.setValue(SettingScope.User, 'security.auth.openrouter.apiKey', apiKey);
    }
    if (baseUrl) {
      settings.setValue(SettingScope.User, 'security.auth.openrouter.baseUrl', baseUrl);
    }
    if (model) {
      settings.setValue(SettingScope.User, 'security.auth.openrouter.model', model);
    }
  } else if (provider === 'custom') {
    if (apiKey) {
      settings.setValue(SettingScope.User, 'security.auth.custom.apiKey', apiKey);
    }
    if (baseUrl) {
      settings.setValue(SettingScope.User, 'security.auth.custom.baseUrl', baseUrl);
    }
    if (model) {
      settings.setValue(SettingScope.User, 'security.auth.custom.model', model);
    }
  } else if (provider === 'anthropic') {
    if (apiKey) {
      settings.setValue(SettingScope.User, 'security.auth.anthropic.apiKey', apiKey);
    }
    if (baseUrl) {
      settings.setValue(SettingScope.User, 'security.auth.anthropic.baseUrl', baseUrl);
    }
    if (model) {
      settings.setValue(SettingScope.User, 'security.auth.anthropic.model', model);
    }
  } else if (provider === 'google') {
    if (apiKey) {
      settings.setValue(SettingScope.User, 'security.auth.google.apiKey', apiKey);
    }
    if (baseUrl) {
      settings.setValue(SettingScope.User, 'security.auth.google.baseUrl', baseUrl);
    }
    if (model) {
      settings.setValue(SettingScope.User, 'security.auth.google.model', model);
    }
  } else if (provider === 'xai') {
    if (apiKey) {
      settings.setValue(SettingScope.User, 'security.auth.xai.apiKey', apiKey);
    }
    if (baseUrl) {
      settings.setValue(SettingScope.User, 'security.auth.xai.baseUrl', baseUrl);
    }
    if (model) {
      settings.setValue(SettingScope.User, 'security.auth.xai.model', model);
    }
  }
};

/**
 * Load provider credentials from settings and set them as environment variables
 * This ensures credentials persist across sessions
 */
export const loadProviderCredentialsFromSettings = (
  settings: LoadedSettings,
): void => {
  const merged = settings.merged;
  const selectedProvider = merged.security?.auth?.selectedProvider;

  // Determine which provider's credentials to load based on selectedProvider
  // This allows us to distinguish between OpenAI and OpenRouter (both use USE_OPENAI auth type)
  if (selectedProvider === 'openai') {
    const openaiApiKey = merged.security?.auth?.openai?.apiKey;
    const openaiBaseUrl = merged.security?.auth?.openai?.baseUrl;
    const openaiModel = merged.security?.auth?.openai?.model;

    if (openaiApiKey && !process.env['OPENAI_API_KEY']) {
      process.env['OPENAI_API_KEY'] = openaiApiKey;
    }
    if (openaiBaseUrl && !process.env['OPENAI_BASE_URL']) {
      process.env['OPENAI_BASE_URL'] = openaiBaseUrl;
    }
    if (openaiModel && !process.env['OPENAI_MODEL']) {
      process.env['OPENAI_MODEL'] = openaiModel;
    }
  } else if (selectedProvider === 'openrouter') {
    const openrouterApiKey = merged.security?.auth?.openrouter?.apiKey;
    const openrouterBaseUrl = merged.security?.auth?.openrouter?.baseUrl;
    const openrouterModel = merged.security?.auth?.openrouter?.model;

    if (openrouterApiKey && !process.env['OPENAI_API_KEY']) {
      // OpenRouter uses OPENAI_API_KEY for compatibility
      process.env['OPENAI_API_KEY'] = openrouterApiKey;
    }
    if (openrouterBaseUrl && !process.env['OPENAI_BASE_URL']) {
      // OpenRouter uses OPENAI_BASE_URL for compatibility
      process.env['OPENAI_BASE_URL'] = openrouterBaseUrl;
    }
    if (openrouterModel && !process.env['OPENAI_MODEL']) {
      process.env['OPENAI_MODEL'] = openrouterModel;
    }
  } else if (selectedProvider === 'blackbox') {
    const blackboxApiKey = merged.security?.auth?.blackbox?.apiKey;
    const blackboxBaseUrl = merged.security?.auth?.blackbox?.baseUrl;
    const blackboxModel = merged.security?.auth?.blackbox?.model;

    if (blackboxApiKey && !process.env['BLACKBOX_API_KEY']) {
      process.env['BLACKBOX_API_KEY'] = blackboxApiKey;
    }
    if (blackboxBaseUrl && !process.env['BLACKBOX_API_BASE_URL']) {
      process.env['BLACKBOX_API_BASE_URL'] = blackboxBaseUrl;
    }
    if (blackboxModel && !process.env['BLACKBOX_API_MODEL']) {
      process.env['BLACKBOX_API_MODEL'] = blackboxModel;
    }
  } else if (selectedProvider === 'custom') {
    const customApiKey = merged.security?.auth?.custom?.apiKey;
    const customBaseUrl = merged.security?.auth?.custom?.baseUrl;
    const customModel = merged.security?.auth?.custom?.model;

    if (customApiKey && !process.env['OPENAI_API_KEY']) {
      // Custom provider uses OPENAI_API_KEY for compatibility with OpenAI-compatible APIs
      process.env['OPENAI_API_KEY'] = customApiKey;
    }
    if (customBaseUrl && !process.env['OPENAI_BASE_URL']) {
      // Custom provider uses OPENAI_BASE_URL for compatibility
      process.env['OPENAI_BASE_URL'] = customBaseUrl;
    }
    if (customModel && !process.env['OPENAI_MODEL']) {
      process.env['OPENAI_MODEL'] = customModel;
    }
  } else if (selectedProvider === 'anthropic') {
    const anthropicApiKey = merged.security?.auth?.anthropic?.apiKey;
    const anthropicBaseUrl = merged.security?.auth?.anthropic?.baseUrl;
    const anthropicModel = merged.security?.auth?.anthropic?.model;

    if (anthropicApiKey && !process.env['OPENAI_API_KEY']) {
      // Anthropic uses OPENAI_API_KEY for compatibility with OpenAI-compatible APIs
      process.env['OPENAI_API_KEY'] = anthropicApiKey;
    }
    if (anthropicBaseUrl && !process.env['OPENAI_BASE_URL']) {
      // Anthropic uses OPENAI_BASE_URL for compatibility
      process.env['OPENAI_BASE_URL'] = anthropicBaseUrl;
    }
    if (anthropicModel && !process.env['OPENAI_MODEL']) {
      process.env['OPENAI_MODEL'] = anthropicModel;
    }
  } else if (selectedProvider === 'google') {
    const googleApiKey = merged.security?.auth?.google?.apiKey;
    const googleBaseUrl = merged.security?.auth?.google?.baseUrl;
    const googleModel = merged.security?.auth?.google?.model;

    if (googleApiKey && !process.env['OPENAI_API_KEY']) {
      // Google uses OPENAI_API_KEY for compatibility with OpenAI-compatible APIs
      process.env['OPENAI_API_KEY'] = googleApiKey;
    }
    if (googleBaseUrl && !process.env['OPENAI_BASE_URL']) {
      // Google uses OPENAI_BASE_URL for compatibility
      process.env['OPENAI_BASE_URL'] = googleBaseUrl;
    }
    if (googleModel && !process.env['OPENAI_MODEL']) {
      process.env['OPENAI_MODEL'] = googleModel;
    }
  } else if (selectedProvider === 'xai') {
    const xaiApiKey = merged.security?.auth?.xai?.apiKey;
    const xaiBaseUrl = merged.security?.auth?.xai?.baseUrl;
    const xaiModel = merged.security?.auth?.xai?.model;

    if (xaiApiKey && !process.env['OPENAI_API_KEY']) {
      // xAI uses OPENAI_API_KEY for compatibility with OpenAI-compatible APIs
      process.env['OPENAI_API_KEY'] = xaiApiKey;
    }
    if (xaiBaseUrl && !process.env['OPENAI_BASE_URL']) {
      // xAI uses OPENAI_BASE_URL for compatibility
      process.env['OPENAI_BASE_URL'] = xaiBaseUrl;
    }
    if (xaiModel && !process.env['OPENAI_MODEL']) {
      process.env['OPENAI_MODEL'] = xaiModel;
    }
  } else {
    // Fallback: If selectedProvider is not set, try to load based on selectedType
    // This provides backward compatibility with older configurations
    const selectedType = merged.security?.auth?.selectedType;
    
    if (selectedType === AuthType.USE_OPENAI) {
      // Try OpenAI first, then OpenRouter
      const openaiApiKey = merged.security?.auth?.openai?.apiKey;
      const openaiBaseUrl = merged.security?.auth?.openai?.baseUrl;
      const openaiModel = merged.security?.auth?.openai?.model;

      if (openaiApiKey && !process.env['OPENAI_API_KEY']) {
        process.env['OPENAI_API_KEY'] = openaiApiKey;
      }
      if (openaiBaseUrl && !process.env['OPENAI_BASE_URL']) {
        process.env['OPENAI_BASE_URL'] = openaiBaseUrl;
      }
      if (openaiModel && !process.env['OPENAI_MODEL']) {
        process.env['OPENAI_MODEL'] = openaiModel;
      }
    } else if (selectedType === AuthType.USE_BLACKBOX_API) {
      const blackboxApiKey = merged.security?.auth?.blackbox?.apiKey;
      const blackboxBaseUrl = merged.security?.auth?.blackbox?.baseUrl;
      const blackboxModel = merged.security?.auth?.blackbox?.model;

      if (blackboxApiKey && !process.env['BLACKBOX_API_KEY']) {
        process.env['BLACKBOX_API_KEY'] = blackboxApiKey;
      }
      if (blackboxBaseUrl && !process.env['BLACKBOX_API_BASE_URL']) {
        process.env['BLACKBOX_API_BASE_URL'] = blackboxBaseUrl;
      }
      if (blackboxModel && !process.env['BLACKBOX_API_MODEL']) {
        process.env['BLACKBOX_API_MODEL'] = blackboxModel;
      }
    }
  }
};
