/**
 * @license
 * Copyright 2025 Blackbox
 * SPDX-License-Identifier: Apache-2.0
 */

export type AvailableModel = {
  id: string;
  label: string;
  isVision?: boolean;
};

export const MAINLINE_VLM = 'vision-model';
export const MAINLINE_CODER = 'coder-model';

export const AVAILABLE_MODELS_BLACKBOX: AvailableModel[] = [
  { id: MAINLINE_CODER, label: MAINLINE_CODER },
  { id: MAINLINE_VLM, label: MAINLINE_VLM, isVision: true },
];

/**
 * Get available Blackbox models filtered by vision model preview setting
 */
export function getFilteredBlackboxModels(
  visionModelPreviewEnabled: boolean,
): AvailableModel[] {
  if (visionModelPreviewEnabled) {
    return AVAILABLE_MODELS_BLACKBOX;
  }
  return AVAILABLE_MODELS_BLACKBOX.filter((model) => !model.isVision);
}

/**
 * Currently we use the single model of `OPENAI_MODEL` in the env.
 * In the future, after settings.json is updated, we will allow users to configure this themselves.
 */
export function getOpenAIAvailableModelFromEnv(): AvailableModel | null {
  const id = process.env['OPENAI_MODEL']?.trim();
  return id ? { id, label: id } : null;
}

/**
 * Get the BlackboxAI model from the environment variable.
 * Similar to OpenAI, we use a single model from BLACKBOX_API_MODEL env var.
 */
export function getBlackboxApiAvailableModelFromEnv(): AvailableModel | null {
  const id = process.env['BLACKBOX_API_MODEL']?.trim();
  return id ? { id, label: id } : null;
}

/**
 * Hard code the default vision model as a string literal,
 * until our coding model supports multimodal.
 */
export function getDefaultVisionModel(): string {
  return MAINLINE_VLM;
}

export function isVisionModel(modelId: string): boolean {
  return AVAILABLE_MODELS_BLACKBOX.some(
    (model) => model.id === modelId && model.isVision,
  );
}
