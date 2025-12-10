/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

export const SERVICE_NAME = 'blackbox-cli';

export const EVENT_USER_PROMPT = 'blackbox-cli.user_prompt';
export const EVENT_TOOL_CALL = 'blackbox-cli.tool_call';
export const EVENT_API_REQUEST = 'blackbox-cli.api_request';
export const EVENT_API_ERROR = 'blackbox-cli.api_error';
export const EVENT_API_RESPONSE = 'blackbox-cli.api_response';
export const EVENT_CLI_CONFIG = 'blackbox-cli.config';
export const EVENT_FLASH_FALLBACK = 'blackbox-cli.flash_fallback';
export const EVENT_NEXT_SPEAKER_CHECK = 'blackbox-cli.next_speaker_check';
export const EVENT_SLASH_COMMAND = 'blackbox-cli.slash_command';
export const EVENT_IDE_CONNECTION = 'blackbox-cli.ide_connection';
export const EVENT_CHAT_COMPRESSION = 'blackbox-cli.chat_compression';
export const EVENT_INVALID_CHUNK = 'blackbox-cli.chat.invalid_chunk';
export const EVENT_CONTENT_RETRY = 'blackbox-cli.chat.content_retry';
export const EVENT_CONTENT_RETRY_FAILURE =
  'blackbox-cli.chat.content_retry_failure';
export const EVENT_CONVERSATION_FINISHED = 'blackbox-cli.conversation_finished';
export const EVENT_MALFORMED_JSON_RESPONSE =
  'blackbox-cli.malformed_json_response';
export const EVENT_SUBAGENT_EXECUTION = 'blackbox-cli.subagent_execution';

export const METRIC_TOOL_CALL_COUNT = 'blackbox-cli.tool.call.count';
export const METRIC_TOOL_CALL_LATENCY = 'blackbox-cli.tool.call.latency';
export const METRIC_API_REQUEST_COUNT = 'blackbox-cli.api.request.count';
export const METRIC_API_REQUEST_LATENCY = 'blackbox-cli.api.request.latency';
export const METRIC_TOKEN_USAGE = 'blackbox-cli.token.usage';
export const METRIC_SESSION_COUNT = 'blackbox-cli.session.count';
export const METRIC_FILE_OPERATION_COUNT = 'blackbox-cli.file.operation.count';
export const METRIC_INVALID_CHUNK_COUNT = 'blackbox-cli.chat.invalid_chunk.count';
export const METRIC_CONTENT_RETRY_COUNT = 'blackbox-cli.chat.content_retry.count';
export const METRIC_CONTENT_RETRY_FAILURE_COUNT =
  'blackbox-cli.chat.content_retry_failure.count';
export const METRIC_SUBAGENT_EXECUTION_COUNT =
  'blackbox-cli.subagent.execution.count';
