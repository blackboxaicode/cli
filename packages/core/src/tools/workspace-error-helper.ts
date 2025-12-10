/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Generates a user-friendly error message when a file path is outside the workspace.
 */
export function generateWorkspacePathError(
  filePath: string,
  workspaceDirectories: readonly string[],
): string {
  return `File path is outside the workspace

Requested path: ${filePath}
Workspace directory: ${workspaceDirectories.join(', ')}

Please make sure you're in the correct project directory and try again.`;
}
