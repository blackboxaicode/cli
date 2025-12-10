/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ToolResult } from './tools.js';
import { BaseDeclarativeTool, BaseToolInvocation, Kind } from './tools.js';
import type { FunctionDeclaration } from '@google/genai';
import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import * as path from 'path';
import * as process from 'process';

import { BLACKBOX_DIR } from '../utils/paths.js';
import type { Config } from '../config/config.js';

export interface TodoItem {
  id: string;
  content: string;
  status: 'pending' | 'in_progress' | 'completed';
}

export interface TodoWriteParams {
  todos: TodoItem[];
  modified_by_user?: boolean;
  modified_content?: string;
}

const todoWriteToolSchemaData: FunctionDeclaration = {
  name: 'todo_write',
  description:
    'Creates and manages a structured task list for your current coding session. This helps track progress, organize complex tasks, and demonstrate thoroughness.',
  parametersJsonSchema: {
    type: 'object',
    properties: {
      todos: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            content: {
              type: 'string',
              minLength: 1,
            },
            status: {
              type: 'string',
              enum: ['pending', 'in_progress', 'completed'],
            },
            id: {
              type: 'string',
            },
          },
          required: ['content', 'status', 'id'],
          additionalProperties: false,
        },
        description: 'The updated todo list',
      },
    },
    required: ['todos'],
    $schema: 'http://json-schema.org/draft-07/schema#',
  },
};

const todoWriteToolDescription = `
Use this tool to create and manage a structured task list for your current coding session. This helps you track progress, organize complex tasks, and demonstrate thoroughness to the user.
It also helps the user understand the progress of the task and overall progress of their requests.

## Task States and Management

1. **Task States**: Use these states to track progress:
   - pending: Task not yet started
   - in_progress: Currently working on (limit to ONE task at a time)
   - completed: Task finished successfully

2. **Task Management**:
   - Update task status in real-time as you work
   - Mark tasks complete IMMEDIATELY after finishing (don't batch completions)
   - Only have ONE task in_progress at any time
   - Complete current tasks before starting new ones
   - Remove tasks that are no longer relevant from the list entirely

3. **Task Completion Requirements**:
   - ONLY mark a task as completed when you have FULLY accomplished it
   - If you encounter errors, blockers, or cannot finish, keep the task as in_progress
   - When blocked, create a new task describing what needs to be resolved
   - Never mark a task as completed if:
     - Tests are failing
     - Implementation is partial
     - You encountered unresolved errors
     - You couldn't find necessary files or dependencies

4. **Task Breakdown**:
   - Create specific, actionable items
   - Break complex tasks into smaller, manageable steps
   - Use clear, descriptive task names

When in doubt, use this tool. Being proactive with task management demonstrates attentiveness and ensures you complete all requirements successfully.
`;

const TODO_SUBDIR = 'todos';

function getTodoFilePath(sessionId?: string): string {
  const homeDir =
    process.env['HOME'] || process.env['USERPROFILE'] || process.cwd();
  const todoDir = path.join(homeDir, BLACKBOX_DIR, TODO_SUBDIR);

  // Use sessionId if provided, otherwise fall back to 'default'
  const filename = `${sessionId || 'default'}.json`;
  return path.join(todoDir, filename);
}

/**
 * Reads the current todos from the file system
 */
async function readTodosFromFile(sessionId?: string): Promise<TodoItem[]> {
  try {
    const todoFilePath = getTodoFilePath(sessionId);
    const content = await fs.readFile(todoFilePath, 'utf-8');
    const data = JSON.parse(content);
    return Array.isArray(data.todos) ? data.todos : [];
  } catch (err) {
    const error = err as Error & { code?: string };
    if (!(error instanceof Error) || error.code !== 'ENOENT') {
      throw err;
    }
    return [];
  }
}

/**
 * Writes todos to the file system
 */
async function writeTodosToFile(
  todos: TodoItem[],
  sessionId?: string,
): Promise<void> {
  const todoFilePath = getTodoFilePath(sessionId);
  const todoDir = path.dirname(todoFilePath);

  await fs.mkdir(todoDir, { recursive: true });

  const data = {
    todos,
    sessionId: sessionId || 'default',
  };

  await fs.writeFile(todoFilePath, JSON.stringify(data, null, 2), 'utf-8');
}

class TodoWriteToolInvocation extends BaseToolInvocation<
  TodoWriteParams,
  ToolResult
> {
  private operationType: 'create' | 'update';

  constructor(
    private readonly config: Config,
    params: TodoWriteParams,
    operationType: 'create' | 'update' = 'update',
  ) {
    super(params);
    this.operationType = operationType;
  }

  getDescription(): string {
    return this.operationType === 'create' ? 'Create todos' : 'Update todos';
  }

  override async shouldConfirmExecute(
    _abortSignal: AbortSignal,
  ): Promise<false> {
    // Todo operations should execute automatically without user confirmation
    return false;
  }

  async execute(_signal: AbortSignal): Promise<ToolResult> {
    const { todos, modified_by_user, modified_content } = this.params;
    const sessionId = this.config.getSessionId();

    try {
      let finalTodos: TodoItem[];

      if (modified_by_user && modified_content !== undefined) {
        // User modified the content in external editor, parse it directly
        const data = JSON.parse(modified_content);
        finalTodos = Array.isArray(data.todos) ? data.todos : [];
      } else {
        // Use the normal todo logic - simply replace with new todos
        finalTodos = todos;
      }

      await writeTodosToFile(finalTodos, sessionId);

      // Create structured display object for rich UI rendering
      const todoResultDisplay = {
        type: 'todo_list' as const,
        todos: finalTodos,
      };

      return {
        llmContent: JSON.stringify({
          success: true,
          todos: finalTodos,
        }),
        returnDisplay: todoResultDisplay,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error(
        `[TodoWriteTool] Error executing todo_write: ${errorMessage}`,
      );
      return {
        llmContent: JSON.stringify({
          success: false,
          error: `Failed to write todos. Detail: ${errorMessage}`,
        }),
        returnDisplay: `Error writing todos: ${errorMessage}`,
      };
    }
  }
}

/**
 * Utility function to read todos for a specific session (useful for session recovery)
 */
export async function readTodosForSession(
  sessionId?: string,
): Promise<TodoItem[]> {
  return readTodosFromFile(sessionId);
}

/**
 * Utility function to list all todo files in the todos directory
 */
export async function listTodoSessions(): Promise<string[]> {
  try {
    const homeDir =
      process.env['HOME'] || process.env['USERPROFILE'] || process.cwd();
    const todoDir = path.join(homeDir, BLACKBOX_DIR, TODO_SUBDIR);
    const files = await fs.readdir(todoDir);
    return files
      .filter((file: string) => file.endsWith('.json'))
      .map((file: string) => file.replace('.json', ''));
  } catch (err) {
    const error = err as Error & { code?: string };
    if (!(error instanceof Error) || error.code !== 'ENOENT') {
      throw err;
    }
    return [];
  }
}

export class TodoWriteTool extends BaseDeclarativeTool<
  TodoWriteParams,
  ToolResult
> {
  static readonly Name: string = todoWriteToolSchemaData.name!;

  constructor(private readonly config: Config) {
    super(
      TodoWriteTool.Name,
      'TodoWrite',
      todoWriteToolDescription,
      Kind.Think,
      todoWriteToolSchemaData.parametersJsonSchema as Record<string, unknown>,
    );
  }

  override validateToolParams(params: TodoWriteParams): string | null {
    // Validate todos array
    if (!Array.isArray(params.todos)) {
      return 'Parameter "todos" must be an array.';
    }

    // Validate individual todos
    for (const todo of params.todos) {
      if (!todo.id || typeof todo.id !== 'string' || todo.id.trim() === '') {
        return 'Each todo must have a non-empty "id" string.';
      }
      if (
        !todo.content ||
        typeof todo.content !== 'string' ||
        todo.content.trim() === ''
      ) {
        return 'Each todo must have a non-empty "content" string.';
      }
      if (!['pending', 'in_progress', 'completed'].includes(todo.status)) {
        return 'Each todo must have a valid "status" (pending, in_progress, completed).';
      }
    }

    // Check for duplicate IDs
    const ids = params.todos.map((todo) => todo.id);
    const uniqueIds = new Set(ids);
    if (ids.length !== uniqueIds.size) {
      return 'Todo IDs must be unique within the array.';
    }

    return null;
  }

  protected createInvocation(params: TodoWriteParams) {
    // Determine if this is a create or update operation by checking if todos file exists
    const sessionId = this.config.getSessionId();
    const todoFilePath = getTodoFilePath(sessionId);
    const operationType = fsSync.existsSync(todoFilePath) ? 'update' : 'create';

    return new TodoWriteToolInvocation(this.config, params, operationType);
  }
}
