/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Tool name constants to avoid circular dependencies.
 * These constants are used across multiple files and should be kept in sync
 * with the actual tool class names.
 */
export const ToolNames = {
  EDIT: 'edit',
  WRITE_FILE: 'write_file',
  READ_FILE: 'read_file',
  READ_MANY_FILES: 'read_many_files',
  READ_DATA_FILE: 'read_data_file',
  GREP: 'search_file_content',
  GLOB: 'glob',
  SHELL: 'run_shell_command',
  TODO_WRITE: 'todo_write',
  MEMORY: 'save_memory',
  TASK: 'task',
  EXIT_PLAN_MODE: 'exit_plan_mode',
  BROWSER_LAUNCH: 'browser_launch',
  BROWSER_NAVIGATE: 'browser_navigate',
  BROWSER_CLICK: 'browser_click',
  BROWSER_TYPE: 'browser_type',
  BROWSER_SCROLL_DOWN: 'browser_scroll_down',
  BROWSER_SCROLL_UP: 'browser_scroll_up',
  BROWSER_CLOSE: 'browser_close',
  WEATHER: 'weather',
  WEB_SEARCH: 'web_search',
} as const;
