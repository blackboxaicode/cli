/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  CountTokensParameters,
  CountTokensResponse,
  EmbedContentParameters,
  EmbedContentResponse,
  GenerateContentParameters,
  GenerateContentResponse,
} from '@google/genai';
import { GoogleGenAI } from '@google/genai';
import { createCodeAssistContentGenerator } from '../code_assist/codeAssist.js';
import type { Config } from '../config/config.js';
import { DEFAULT_GEMINI_MODEL, DEFAULT_BLACKBOX_MODEL, DEFAULT_BLACKBOX_API_MODEL } from '../config/models.js';

import type { UserTierId } from '../code_assist/types.js';
import { InstallationManager } from '../utils/installationManager.js';
import { LoggingContentGenerator } from './loggingContentGenerator.js';

/**
 * Interface abstracting the core functionalities for generating content and counting tokens.
 */
export interface ContentGenerator {
  generateContent(
    request: GenerateContentParameters,
    userPromptId: string,
  ): Promise<GenerateContentResponse>;

  generateContentStream(
    request: GenerateContentParameters,
    userPromptId: string,
  ): Promise<AsyncGenerator<GenerateContentResponse>>;

  countTokens(request: CountTokensParameters): Promise<CountTokensResponse>;

  embedContent(request: EmbedContentParameters): Promise<EmbedContentResponse>;

  userTier?: UserTierId;
}

export enum AuthType {
  LOGIN_WITH_GOOGLE = 'oauth-personal',
  USE_GEMINI = 'gemini-api-key',
  USE_VERTEX_AI = 'vertex-ai',
  CLOUD_SHELL = 'cloud-shell',
  USE_OPENAI = 'openai',
  BLACKBOX_OAUTH = 'blackbox-oauth',
  USE_BLACKBOX_API = 'blackbox-api',
}

export type ContentGeneratorConfig = {
  model: string;
  apiKey?: string;
  baseUrl?: string;
  vertexai?: boolean;
  authType?: AuthType | undefined;
  enableOpenAILogging?: boolean;
  // Timeout configuration in milliseconds
  timeout?: number;
  // Maximum retries for failed requests
  maxRetries?: number;
  // Disable cache control for DashScope providers
  disableCacheControl?: boolean;
  samplingParams?: {
    top_p?: number;
    top_k?: number;
    repetition_penalty?: number;
    presence_penalty?: number;
    frequency_penalty?: number;
    temperature?: number;
    max_tokens?: number;
  };
  proxy?: string | undefined;
  userAgent?: string;
};

export function createContentGeneratorConfig(
  config: Config,
  authType: AuthType | undefined,
): ContentGeneratorConfig {
  const geminiApiKey = process.env['GEMINI_API_KEY'] || undefined;
  const googleApiKey = process.env['GOOGLE_API_KEY'] || undefined;
  const googleCloudProject = process.env['GOOGLE_CLOUD_PROJECT'] || undefined;
  const googleCloudLocation = process.env['GOOGLE_CLOUD_LOCATION'] || undefined;

  // openai auth
  const openaiApiKey = process.env['OPENAI_API_KEY'] || undefined;
  const openaiBaseUrl = process.env['OPENAI_BASE_URL'] || undefined;
  const openaiModel = process.env['OPENAI_MODEL'] || undefined;

  // blackbox auth
  const blackboxApiKey = process.env['BLACKBOX_API_KEY'] || undefined;
  const blackboxApiBaseUrl = process.env['BLACKBOX_API_BASE_URL'] || undefined;
  const blackboxApiModel = process.env['BLACKBOX_API_MODEL'] || undefined;

  // Use runtime model from config if available; otherwise, fall back to parameter or default
  const effectiveModel = config.getModel() || DEFAULT_GEMINI_MODEL;

  const contentGeneratorConfig: ContentGeneratorConfig = {
    model: effectiveModel,
    authType,
    proxy: config?.getProxy(),
    enableOpenAILogging: config.getEnableOpenAILogging(),
    timeout: config.getContentGeneratorTimeout(),
    maxRetries: config.getContentGeneratorMaxRetries(),
    disableCacheControl: config.getContentGeneratorDisableCacheControl(),
    samplingParams: config.getContentGeneratorSamplingParams(),
  };

  // If we are using Google auth or we are in Cloud Shell, there is nothing else to validate for now
  if (
    authType === AuthType.LOGIN_WITH_GOOGLE ||
    authType === AuthType.CLOUD_SHELL
  ) {
    return contentGeneratorConfig;
  }

  if (authType === AuthType.USE_GEMINI && geminiApiKey) {
    contentGeneratorConfig.apiKey = geminiApiKey;
    contentGeneratorConfig.vertexai = false;

    return contentGeneratorConfig;
  }

  if (
    authType === AuthType.USE_VERTEX_AI &&
    (googleApiKey || (googleCloudProject && googleCloudLocation))
  ) {
    contentGeneratorConfig.apiKey = googleApiKey;
    contentGeneratorConfig.vertexai = true;

    return contentGeneratorConfig;
  }

  if (authType === AuthType.USE_OPENAI && openaiApiKey) {
    contentGeneratorConfig.apiKey = openaiApiKey;
    contentGeneratorConfig.baseUrl = openaiBaseUrl;
    contentGeneratorConfig.model = openaiModel || DEFAULT_BLACKBOX_MODEL;

    return contentGeneratorConfig;
  }

  if (authType === AuthType.BLACKBOX_OAUTH) {
    // For Blackbox OAuth, we'll handle the API key dynamically in createContentGenerator
    // Set a special marker to indicate this is Blackbox OAuth
    contentGeneratorConfig.apiKey = 'BLACKBOX_OAUTH_DYNAMIC_TOKEN';

    // Prefer to use blackbox3-coder-plus as the default Blackbox model if BLACKBOX_MODEL is not set.
    contentGeneratorConfig.model =
      process.env['BLACKBOX_MODEL'] || DEFAULT_BLACKBOX_MODEL;

    return contentGeneratorConfig;
  }

  if (authType === AuthType.USE_BLACKBOX_API && blackboxApiKey) {
    contentGeneratorConfig.apiKey = blackboxApiKey;
    contentGeneratorConfig.baseUrl = blackboxApiBaseUrl || 'https://api.blackbox.ai';
    contentGeneratorConfig.model = blackboxApiModel || DEFAULT_BLACKBOX_API_MODEL;

    return contentGeneratorConfig;
  }

  return contentGeneratorConfig;
}

export async function createContentGenerator(
  config: ContentGeneratorConfig,
  gcConfig: Config,
  sessionId?: string,
): Promise<ContentGenerator> {
  const version = process.env['CLI_VERSION'] || process.version;
  const userAgent = `BlackboxCode/${version} (${process.platform}; ${process.arch})`;
  const baseHeaders: Record<string, string> = {
    'User-Agent': userAgent,
  };

  if (
    config.authType === AuthType.LOGIN_WITH_GOOGLE ||
    config.authType === AuthType.CLOUD_SHELL
  ) {
    const httpOptions = { headers: baseHeaders };
    return new LoggingContentGenerator(
      await createCodeAssistContentGenerator(
        httpOptions,
        config.authType,
        gcConfig,
        sessionId,
      ),
      gcConfig,
    );
  }

  if (
    config.authType === AuthType.USE_GEMINI ||
    config.authType === AuthType.USE_VERTEX_AI
  ) {
    let headers: Record<string, string> = { ...baseHeaders };
    if (gcConfig?.getUsageStatisticsEnabled()) {
      const installationManager = new InstallationManager();
      const installationId = installationManager.getInstallationId();
      headers = {
        ...headers,
        'x-gemini-api-privileged-user-id': `${installationId}`,
      };
    }
    const httpOptions = { headers };

    const googleGenAI = new GoogleGenAI({
      apiKey: config.apiKey === '' ? undefined : config.apiKey,
      vertexai: config.vertexai,
      httpOptions,
    });
    return new LoggingContentGenerator(googleGenAI.models, gcConfig);
  }

  if (config.authType === AuthType.USE_OPENAI) {
    if (!config.apiKey) {
      throw new Error('OpenAI API key is required');
    }

    // Import OpenAIContentGenerator dynamically to avoid circular dependencies
    const { createOpenAIContentGenerator } = await import(
      './openaiContentGenerator/index.js'
    );

    // Always use OpenAIContentGenerator, logging is controlled by enableOpenAILogging flag
    return createOpenAIContentGenerator(config, gcConfig);
  }

  if (config.authType === AuthType.BLACKBOX_OAUTH) {
    // Import required classes dynamically
    const { getBlackboxOAuthClient: getBlackboxOauthClient } = await import(
      '../blackbox/blackboxOAuth2.js'
    );
    const { BlackboxContentGenerator } = await import(
      '../blackbox/blackboxContentGenerator.js'
    );

    try {
      // Get the Blackbox OAuth client (now includes integrated token management)
      const blackboxClient = await getBlackboxOauthClient(gcConfig);

      // Create the content generator with dynamic token management
      return new BlackboxContentGenerator(blackboxClient, config, gcConfig);
    } catch (error) {
      throw new Error(
        `Failed to initialize Blackbox: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  if (config.authType === AuthType.USE_BLACKBOX_API) {
    if (!config.apiKey) {
      throw new Error('BlackboxAI API key is required');
    }

    // Import OpenAIContentGenerator dynamically to reuse for BlackboxAI
    const { createOpenAIContentGenerator } = await import(
      './openaiContentGenerator/index.js'
    );

    // Use OpenAIContentGenerator for BlackboxAI (compatible API)
    return createOpenAIContentGenerator(config, gcConfig);
  }

  throw new Error(
    `Error creating contentGenerator: Unsupported authType: ${config.authType}`,
  );
}
