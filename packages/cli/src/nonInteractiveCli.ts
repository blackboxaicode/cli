/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Config, ToolCallRequestInfo } from '@blackbox_ai/blackbox-cli-core';
import {
  executeToolCall,
  shutdownTelemetry,
  isTelemetrySdkInitialized,
  GeminiEventType,
  parseAndFormatApiError,
  FatalInputError,
  FatalTurnLimitedError,
  Logger,
  decodeTagName,
} from '@blackbox_ai/blackbox-cli-core';
import { FinishReason, type Content, type Part } from '@google/genai';
import * as fsPromises from 'node:fs/promises';
import path from 'node:path';

import { ConsolePatcher } from './ui/utils/ConsolePatcher.js';
import { handleAtCommand } from './ui/hooks/atCommandProcessor.js';

// Minimal ANSI color helpers (avoid extra deps; disable when not a TTY or NO_COLOR=1)
const USE_COLOR =
  Boolean(process.stdout.isTTY) && process.env['NO_COLOR'] !== '1';
const ansi = (open: number, close: number) => (s: string) =>
  USE_COLOR ? `\u001b[${open}m${s}\u001b[${close}m` : s;
const bold = ansi(1, 22);
const dim = ansi(2, 22);
const red = ansi(31, 39);
const green = ansi(32, 39);
const yellow = ansi(33, 39);
const blue = ansi(34, 39);
const magenta = ansi(35, 39);
const cyan = ansi(36, 39);
const gray = ansi(90, 39);

function printInfoToStderr(prefix: string, message: string) {
  console.error(`${prefix} ${message}`);
}

function printToolSectionToStdout(toolName: string, content: string) {
  const columns = Math.max(30, Math.min(100, process.stdout.columns || 80));
  const horizontal = '─'.repeat(columns - 2);
  const top = USE_COLOR
    ? cyan(`┌${horizontal}┐`)
    : `┌${horizontal}┐`;
  const bottom = USE_COLOR
    ? cyan(`└${horizontal}┘`)
    : `└${horizontal}┘`;
  const title = `${bold(cyan('Tool'))} ${bold(magenta(toolName))}`;
  const titleLine = `│ ${title}${' '.repeat(Math.max(0, columns - 3 - title.length))}│`;
  const lines = content.split(/\r?\n/);
  const body = lines
    .map((line) => {
      const safe = line.replace(/\t/g, '    ');
      const visibleLen = safe.length; // best-effort; we avoid nested ANSI here
      const padding = Math.max(0, columns - 3 - visibleLen);
      return `│ ${safe}${' '.repeat(padding)}│`;
    })
    .join('\n');
  process.stdout.write(`\n${top}\n${titleLine}\n${gray(`│${' '.repeat(columns - 2)}│`)}\n${body}\n${bottom}\n`);
}

/**
 * Formats tool result display for clean, user-friendly output.
 * Handles different result types similar to the interactive mode.
 */
function formatToolResultDisplay(resultDisplay: unknown): string | null {
  if (!resultDisplay) {
    return null;
  }

  // Handle string results with truncation for very long outputs
  if (typeof resultDisplay === 'string') {
    const MAX_STRING_LENGTH = 2000;
    if (resultDisplay.length > MAX_STRING_LENGTH) {
      const truncated = resultDisplay.substring(0, MAX_STRING_LENGTH);
      const remaining = resultDisplay.length - MAX_STRING_LENGTH;
      return `${truncated}\n\n${dim(`... (${remaining} more characters truncated)`)}`;
    }
    return resultDisplay;
  }

  // Handle object results
  if (typeof resultDisplay === 'object' && resultDisplay !== null) {
    // Check for FileDiff (write_file, edit_file results)
    if ('fileDiff' in resultDisplay && 'fileName' in resultDisplay) {
      const result = resultDisplay as { 
        fileDiff: string; 
        fileName: string; 
        newContent?: string; 
        originalContent?: string;
        diffStat?: {
          ai_added_lines?: number;
          ai_removed_lines?: number;
        };
      };
      
      let summary = `${bold('File:')} ${result.fileName}\n`;
      
      // Parse the diff to show visual changes
      const diffLines = result.fileDiff.split('\n');
      const addedLines: string[] = [];
      const removedLines: string[] = [];
      
      for (const line of diffLines) {
        if (line.startsWith('+') && !line.startsWith('+++')) {
          const content = line.substring(1);
          // Skip empty lines that are just formatting
          if (content.trim().length > 0) {
            addedLines.push(content);
          }
        } else if (line.startsWith('-') && !line.startsWith('---')) {
          const content = line.substring(1);
          // Skip empty lines that are just formatting
          if (content.trim().length > 0) {
            removedLines.push(content);
          }
        }
      }
      
      // Show change statistics - use actual parsed lines, not diffStat which includes markers
      const totalAdded = addedLines.length;
      const totalRemoved = removedLines.length;
      
      if (totalAdded > 0 || totalRemoved > 0) {
        summary += `${bold('Changes:')} `;
        if (totalRemoved > 0) summary += `${red(`-${totalRemoved} lines`)} `;
        if (totalAdded > 0) summary += `${green(`+${totalAdded} lines`)}`;
        summary += '\n\n';
      }
      
      // Show visual diff (deletions and additions)
      const MAX_DIFF_LINES = 15;
      let diffDisplay = '';
      
      if (removedLines.length > 0) {
        diffDisplay += `${bold(red('Removed:'))}\n`;
        const linesToShow = removedLines.slice(0, MAX_DIFF_LINES);
        for (const line of linesToShow) {
          diffDisplay += `${red('- ' + line)}\n`;
        }
        if (removedLines.length > MAX_DIFF_LINES) {
          diffDisplay += `${dim(`... (${removedLines.length - MAX_DIFF_LINES} more lines removed)`)}\n`;
        }
        diffDisplay += '\n';
      }
      
      if (addedLines.length > 0) {
        diffDisplay += `${bold(green('Added:'))}\n`;
        const linesToShow = addedLines.slice(0, MAX_DIFF_LINES);
        for (const line of linesToShow) {
          diffDisplay += `${green('+ ' + line)}\n`;
        }
        if (addedLines.length > MAX_DIFF_LINES) {
          diffDisplay += `${dim(`... (${addedLines.length - MAX_DIFF_LINES} more lines added)`)}\n`;
        }
      }
      
      if (diffDisplay) {
        summary += diffDisplay;
      } else if (result.newContent) {
        // Fallback: show content preview if no diff lines parsed
        const MAX_CONTENT_PREVIEW = 300;
        if (result.newContent.length < MAX_CONTENT_PREVIEW) {
          summary += `${bold('Content:')}\n${dim(result.newContent)}`;
        } else {
          const preview = result.newContent.substring(0, MAX_CONTENT_PREVIEW);
          const remaining = result.newContent.length - MAX_CONTENT_PREVIEW;
          summary += `${bold('Content preview:')}\n${dim(preview)}\n${dim(`... (${remaining} more characters)`)}`;
        }
      }
      
      return summary.trim();
    }

    // Check for todo_list results
    if ('type' in resultDisplay && resultDisplay.type === 'todo_list') {
      const todoResult = resultDisplay as unknown as { 
        todos: Array<{ 
          id: string; 
          content: string; 
          status: 'pending' | 'in_progress' | 'completed' 
        }> 
      };
      let output = `${bold('TODO List:')}\n`;
      if (Array.isArray(todoResult.todos)) {
        const MAX_TODOS = 20;
        const todosToShow = todoResult.todos.slice(0, MAX_TODOS);
        todosToShow.forEach((todo) => {
          // Use status icons matching the UI
          const statusIcon = {
            pending: '○',
            in_progress: '◐',
            completed: '●',
          }[todo.status] || '○';
          
          const checkbox = todo.status === 'completed' ? '[✓]' : '[ ]';
          output += `${checkbox} ${statusIcon} ${todo.content}\n`;
        });
        if (todoResult.todos.length > MAX_TODOS) {
          output += `${dim(`... (${todoResult.todos.length - MAX_TODOS} more todos)`)}`;
        }
      }
      return output.trim();
    }

    // Check for task_execution (subagent) results
    if ('type' in resultDisplay && resultDisplay.type === 'task_execution') {
      const taskResult = resultDisplay as unknown as {
        subagentName: string;
        taskDescription: string;
        status: string;
        result?: string;
        terminateReason?: string;
      };
      let output = `${bold(cyan('Subagent:'))} ${magenta(taskResult.subagentName)}\n`;
      output += `${bold('Task:')} ${taskResult.taskDescription}\n`;
      output += `${bold('Status:')} ${taskResult.status}\n`;
      if (taskResult.result) {
        const MAX_RESULT_LENGTH = 1000;
        if (taskResult.result.length > MAX_RESULT_LENGTH) {
          const truncated = taskResult.result.substring(0, MAX_RESULT_LENGTH);
          const remaining = taskResult.result.length - MAX_RESULT_LENGTH;
          output += `${bold('Result:')}\n${truncated}\n${dim(`... (${remaining} more characters)`)}`;
        } else {
          output += `${bold('Result:')}\n${taskResult.result}`;
        }
      }
      return output;
    }

    // Check for plan_summary results
    if ('type' in resultDisplay && resultDisplay.type === 'plan_summary') {
      const planResult = resultDisplay as unknown as { message: string; plan: string };
      return `${bold(planResult.message)}\n\n${planResult.plan}`;
    }

    // For other objects, show a clean summary instead of raw JSON
    // Extract key information if available
    const obj = resultDisplay as Record<string, unknown>;
    if ('message' in obj && typeof obj['message'] === 'string') {
      const msg = obj['message'];
      if (msg.length > 1000) {
        return msg.substring(0, 1000) + dim('\n... (truncated)');
      }
      return msg;
    }
    if ('result' in obj && typeof obj['result'] === 'string') {
      const res = obj['result'];
      if (res.length > 1000) {
        return res.substring(0, 1000) + dim('\n... (truncated)');
      }
      return res;
    }
    if ('output' in obj && typeof obj['output'] === 'string') {
      const out = obj['output'];
      if (out.length > 1000) {
        return out.substring(0, 1000) + dim('\n... (truncated)');
      }
      return out;
    }
    
    // Last resort: show formatted JSON but only for small objects
    const jsonStr = JSON.stringify(resultDisplay, null, 2);
    const MAX_JSON_LENGTH = 500;
    if (jsonStr.length < MAX_JSON_LENGTH) {
      return jsonStr;
    }
    
    // For large objects, show a summary
    return `${bold('Result:')} ${dim('[Complex object with ' + Object.keys(obj).length + ' properties - output truncated]')}`;
  }

  return String(resultDisplay);
}

function printPlanSectionToStderr(
  toolName: string,
  planDescription: string,
  argsJsonPretty: string,
) {
  const columns = Math.max(30, Math.min(100, process.stderr.columns || process.stdout.columns || 80));
  const horizontal = '─'.repeat(columns - 2);
  const top = USE_COLOR ? yellow(`┌${horizontal}┐`) : `┌${horizontal}┐`;
  const bottom = USE_COLOR ? yellow(`└${horizontal}┘`) : `└${horizontal}┘`;
  const title = `${bold(yellow('Tool'))} ${bold(magenta(toolName))}`;
  const titleLine = `│ ${title}${' '.repeat(Math.max(0, columns - 3 - title.length))}│`;
  const bodyLines = [`${bold('Description:')}`, planDescription || '(none)', '', `${bold('Invocation payload:')}`, argsJsonPretty];
  const body = bodyLines
    .flatMap((line) => (line.includes('\n') ? line.split(/\r?\n/) : [line]))
    .map((line) => {
      const safe = line.replace(/\t/g, '    ');
      const visibleLen = safe.length;
      const padding = Math.max(0, columns - 3 - visibleLen);
      return `│ ${safe}${' '.repeat(padding)}│`;
    })
    .join('\n');
  process.stderr.write(`\n${top}\n${titleLine}\n${gray(`│${' '.repeat(columns - 2)}│`)}\n${body}\n${bottom}\n`);
}

/**
 * Lists all available checkpoints and exits
 */
export async function listCheckpoints(config: Config): Promise<void> {
  try {
    const geminiDir = config.storage?.getProjectTempDir();
    if (!geminiDir) {
      printInfoToStderr(red('✖ Error'), 'Could not determine the .blackboxcli directory path.');
      process.exit(1);
    }

    const file_head = 'checkpoint-';
    const file_tail = '.json';
    const files = await fsPromises.readdir(geminiDir);
    const checkpoints: Array<{ name: string; mtime: Date }> = [];

    for (const file of files) {
      if (file.startsWith(file_head) && file.endsWith(file_tail)) {
        const filePath = path.join(geminiDir, file);
        const stats = await fsPromises.stat(filePath);
        const tagName = file.slice(file_head.length, -file_tail.length);
        checkpoints.push({
          name: decodeTagName(tagName),
          mtime: stats.mtime,
        });
      }
    }

    if (checkpoints.length === 0) {
      console.log('No saved conversation checkpoints found.');
      process.exit(0);
    }

    // Sort by modification time (newest first)
    checkpoints.sort((a, b) => b.mtime.getTime() - a.mtime.getTime());

    const maxNameLength = Math.max(...checkpoints.map((cp) => cp.name.length));

    console.log('Available conversation checkpoints:\n');
    for (const checkpoint of checkpoints) {
      const paddedName = checkpoint.name.padEnd(maxNameLength, ' ');
      const isoString = checkpoint.mtime.toISOString();
      const match = isoString.match(/(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2}:\d{2})/);
      const formattedDate = match ? `${match[1]} ${match[2]}` : 'Invalid Date';
      console.log(`  ${cyan(paddedName)}  ${gray(`(saved on ${formattedDate})`)}`);
    }
    console.log(`\n${gray('Resume with:')} ${cyan('blackbox --resume-checkpoint "<tag>" --prompt "<new-task>"')}`);
    process.exit(0);
  } catch (error) {
    printInfoToStderr(red('✖ Error'), `Failed to list checkpoints: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}

/**
 * Resumes conversation from a checkpoint
 */
async function resumeFromCheckpoint(config: Config, tag: string): Promise<void> {
  try {
    const logger = new Logger(config.getSessionId(), config.storage);
    await logger.initialize();
    
    const conversation = await logger.loadCheckpoint(tag);
    
    if (conversation.length === 0) {
      printInfoToStderr(red('✖ Error'), `No saved checkpoint found with tag: ${decodeTagName(tag)}`);
      process.exit(1);
    }

    // Restore the conversation history to the Gemini client
    const geminiClient = config.getGeminiClient();
    if (geminiClient && geminiClient.isInitialized()) {
      geminiClient.setHistory(conversation);
      printInfoToStderr(
        green('✓ Checkpoint restored:'),
        `${bold(decodeTagName(tag))} ${dim('(continuing conversation)')}`
      );
    } else {
      printInfoToStderr(red('✖ Error'), 'Gemini client not initialized');
      process.exit(1);
    }
  } catch (error) {
    printInfoToStderr(red('✖ Error'), `Failed to resume checkpoint: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}

/**
 * Generates a safe, unique checkpoint name using UUID and timestamp
 */
function generateCheckpointName(): string {
  // Generate a simple UUID-like string (8 characters)
  const uuid = Math.random().toString(36).substring(2, 10);
  
  // Generate timestamp
  const now = new Date();
  const timestamp = now.toISOString()
    .replace(/[:.]/g, '-')
    .replace('T', '-')
    .substring(0, 19); // YYYY-MM-DD-HH-MM-SS

  return `task-${uuid}-${timestamp}`;
}

/**
 * Saves conversation checkpoint after successful task completion in non-interactive mode
 */
async function saveConversationCheckpoint(
  config: Config,
  originalInput: string,
  customTag?: string,
): Promise<void> {
  try {
    const chat = config.getGeminiClient()?.getChat();
    if (!chat) return;

    const history = chat.getHistory();
    if (history.length <= 2) return; // No meaningful conversation

    const logger = new Logger(config.getSessionId(), config.storage);
    await logger.initialize();

    let tag: string;
    if (customTag) {
      tag = customTag;
    } else {
      // Generate safe, unique tag
      tag = generateCheckpointName();
    }

    await logger.saveCheckpoint(history, tag);
    
    // Get the full path to the checkpoint file
    const checkpointDir = config.storage?.getProjectTempDir();
    const checkpointPath = checkpointDir ? path.join(checkpointDir, `checkpoint-${tag}.json`) : `checkpoint-${tag}.json`;
    
    printInfoToStderr(
      green('✓ Checkpoint saved:'),
      `${bold(tag)}\n  ${dim('- Path:')} ${checkpointPath}\n  ${dim('- Resume with:')} ${cyan(`blackbox`)} ${dim('then')} ${cyan(`/chat resume "${tag}"`)}`,
    );
  } catch (error) {
    // Don't fail the main task if checkpoint saving fails
    if (config.getDebugMode()) {
      printInfoToStderr(
        yellow('⚠ Checkpoint save failed:'),
        error instanceof Error ? error.message : String(error),
      );
    }
  }
}

export async function runNonInteractive(
  config: Config,
  input: string,
  prompt_id: string,
): Promise<void> {
  // Handle list checkpoints command
  if (config.getListCheckpoints()) {
    await listCheckpoints(config);
    return;
  }

  // Handle resume checkpoint
  const resumeTag = config.getResumeCheckpoint();
  if (resumeTag) {
    await resumeFromCheckpoint(config, resumeTag);
  }

  const consolePatcher = new ConsolePatcher({
    stderr: true,
    debugMode: config.getDebugMode(),
  });

  try {
    consolePatcher.patch();
    // Handle EPIPE errors when the output is piped to a command that closes early.
    process.stdout.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EPIPE') {
        // Exit gracefully if the pipe is closed.
        process.exit(0);
      }
    });

    const geminiClient = config.getGeminiClient();

    const abortController = new AbortController();

    const { processedQuery, shouldProceed } = await handleAtCommand({
      query: input,
      config,
      addItem: (_item, _timestamp) => 0,
      onDebugMessage: () => {},
      messageId: Date.now(),
      signal: abortController.signal,
    });

    if (!shouldProceed || !processedQuery) {
      // An error occurred during @include processing (e.g., file not found).
      // The error message is already logged by handleAtCommand.
      throw new FatalInputError(
        'Exiting due to an error processing the @ command.',
      );
    }

    let currentMessages: Content[] = [
      { role: 'user', parts: processedQuery as Part[] },
    ];

    let turnCount = 0;
    while (true) {
      turnCount++;
      if (
        config.getMaxSessionTurns() >= 0 &&
        turnCount > config.getMaxSessionTurns()
      ) {
        throw new FatalTurnLimitedError(
          'Reached max session turns for this session. Increase the number of turns by specifying maxSessionTurns in settings.json.',
        );
      }
      const toolCallRequests: ToolCallRequestInfo[] = [];

      const responseStream = geminiClient.sendMessageStream(
        currentMessages[0]?.parts || [],
        abortController.signal,
        prompt_id,
      );

      for await (const event of responseStream) {
        if (abortController.signal.aborted) {
          console.error('Operation cancelled.');
          return;
        }

        switch (event.type) {
          case GeminiEventType.Content: {
            process.stdout.write(event.value);
            break;
          }
          case GeminiEventType.ToolCallRequest: {
            toolCallRequests.push(event.value);
            break;
          }
          case GeminiEventType.Thought: {
            // Keep agent "thoughts" off stdout so piping remains clean
            printInfoToStderr(
              cyan('ℹ Thought:'),
              `${bold(event.value.subject)} ${dim('-')} ${event.value.description}`,
            );
            break;
          }
          case GeminiEventType.Retry: {
            printInfoToStderr(yellow('↻ Retrying'), dim('request...'));
            break;
          }
          case GeminiEventType.ChatCompressed: {
            printInfoToStderr(
              blue('ℹ Compression'),
              `Using compressed context (${event.value?.originalTokenCount ?? 'unknown'} → ${event.value?.newTokenCount ?? 'unknown'} tokens).`,
            );
            break;
          }
          case GeminiEventType.MaxSessionTurns: {
            printInfoToStderr(yellow('⚠ Max turns'), 'Reached max session turns.');
            return;
          }
          case GeminiEventType.SessionTokenLimitExceeded: {
            printInfoToStderr(
              red('🚫 Token limit'),
              `${event.value.message}\n` +
                `${dim('Tips:')}\n` +
                `  ${dim('•')} Start a new session.\n` +
                `  ${dim('•')} Increase limit via settings.json (sessionTokenLimit).\n` +
                `  ${dim('•')} Compress history using /compress in interactive mode.`,
            );
            return;
          }
          case GeminiEventType.Finished: {
            const finishReason = event.value as FinishReason;
            const finishReasonMessages: Partial<Record<FinishReason, string>> = {
              [FinishReason.MAX_TOKENS]:
                'Response truncated due to token limits.',
              [FinishReason.SAFETY]: 'Response stopped due to safety reasons.',
              [FinishReason.RECITATION]:
                'Response stopped due to recitation policy.',
              [FinishReason.LANGUAGE]:
                'Response stopped due to unsupported language.',
              [FinishReason.BLOCKLIST]:
                'Response stopped due to forbidden terms.',
              [FinishReason.PROHIBITED_CONTENT]:
                'Response stopped due to prohibited content.',
              [FinishReason.SPII]:
                'Response stopped due to sensitive personally identifiable information.',
              [FinishReason.OTHER]: 'Response stopped for other reasons.',
              [FinishReason.MALFORMED_FUNCTION_CALL]:
                'Response stopped due to malformed function call.',
              [FinishReason.IMAGE_SAFETY]:
                'Response stopped due to image safety violations.',
              [FinishReason.UNEXPECTED_TOOL_CALL]:
                'Response stopped due to unexpected tool call.',
              [FinishReason.IMAGE_PROHIBITED_CONTENT]:
                'Response stopped due to prohibited image content.',
              [FinishReason.NO_IMAGE]:
                'Response stopped because no image was provided.',
            };
            const message = finishReasonMessages[finishReason];
            if (message) {
              printInfoToStderr(yellow('⚠ Finished'), message);
            }
            break;
          }
          case GeminiEventType.LoopDetected: {
            printInfoToStderr(
              magenta('⚠ Loop detected'),
              'A potential loop was detected. The request has been halted.',
            );
            return;
          }
          case GeminiEventType.Error: {
            printInfoToStderr(red('✖ Error'), event.value.error.message);
            return;
          }
          default: {
            // Ignore other event types in non-interactive mode
            break;
          }
        }
      }

      if (toolCallRequests.length > 0) {
        const toolResponseParts: Part[] = [];
        for (const requestInfo of toolCallRequests) {
          // Build a plan preview using ToolRegistry if available
          try {
            const tool = config.getToolRegistry().getTool(requestInfo.name);
            if (tool) {
              const invocation = tool.build(
                requestInfo.args as Record<string, unknown>,
              );
              const description = invocation.getDescription() || '';
              
              // For edit_file, edit, and write_file, hide long content in the payload
              let argsToShow = requestInfo.args;
              const MAX_CONTENT_DISPLAY = 200;
              
              // Hide edit_file SEARCH/REPLACE content
              if (requestInfo.name === 'edit_file' && requestInfo.args && typeof requestInfo.args === 'object') {
                const args = requestInfo.args as Record<string, unknown>;
                if ('content' in args && typeof args['content'] === 'string') {
                  const content = args['content'] as string;
                  // Show a summary instead of the full SEARCH/REPLACE blocks
                  const searchBlocks = (content.match(/<<<<<<< SEARCH/g) || []).length;
                  argsToShow = {
                    ...args,
                    content: `[${searchBlocks} edit block${searchBlocks !== 1 ? 's' : ''} - content hidden for clarity]`
                  };
                }
              }
              
              // Hide edit tool old_string and new_string if they're long
              if (requestInfo.name === 'edit' && requestInfo.args && typeof requestInfo.args === 'object') {
                const args = requestInfo.args as Record<string, unknown>;
                const updatedArgs = { ...args };
                
                if ('old_string' in args && typeof args['old_string'] === 'string') {
                  const oldString = args['old_string'] as string;
                  if (oldString.length > MAX_CONTENT_DISPLAY) {
                    const lines = oldString.split('\n').length;
                    const chars = oldString.length;
                    updatedArgs['old_string'] = `[Content hidden - ${lines} lines, ${chars} characters]`;
                  }
                }
                
                if ('new_string' in args && typeof args['new_string'] === 'string') {
                  const newString = args['new_string'] as string;
                  if (newString.length > MAX_CONTENT_DISPLAY) {
                    const lines = newString.split('\n').length;
                    const chars = newString.length;
                    updatedArgs['new_string'] = `[Content hidden - ${lines} lines, ${chars} characters]`;
                  }
                }
                
                argsToShow = updatedArgs;
              }
              
              // Hide write_file content if it's long
              if (requestInfo.name === 'write_file' && requestInfo.args && typeof requestInfo.args === 'object') {
                const args = requestInfo.args as Record<string, unknown>;
                if ('content' in args && typeof args['content'] === 'string') {
                  const content = args['content'] as string;
                  if (content.length > MAX_CONTENT_DISPLAY) {
                    const lines = content.split('\n').length;
                    const chars = content.length;
                    argsToShow = {
                      ...args,
                      content: `[Content hidden - ${lines} lines, ${chars} characters]`
                    };
                  }
                }
              }
              
              const prettyArgs = JSON.stringify(argsToShow, null, 2);
              printPlanSectionToStderr(requestInfo.name, description, prettyArgs);
            } else {
              const prettyArgs = JSON.stringify(requestInfo.args, null, 2);
              printPlanSectionToStderr(
                requestInfo.name,
                '(tool not found in registry)',
                prettyArgs,
              );
            }
          } catch (_e) {
            // If plan building fails, still show the raw args so users see payload
            const prettyArgs = JSON.stringify(requestInfo.args, null, 2);
            printPlanSectionToStderr(
              requestInfo.name,
              '(failed to build plan; showing raw payload)',
              prettyArgs,
            );
          }

          const toolResponse = await executeToolCall(
            config,
            requestInfo,
            abortController.signal,
          );

          if (
            toolResponse.error &&
            !config.getSupressToolIterationErrors()
          ) {
            console.error(
              `Error executing tool ${requestInfo.name}: ${toolResponse.resultDisplay || toolResponse.error.message}`,
            );
          }
          // Print tool results to stdout with a styled section
          if (toolResponse.resultDisplay) {
            const displayContent = formatToolResultDisplay(toolResponse.resultDisplay);
            if (displayContent) {
              printToolSectionToStdout(requestInfo.name, displayContent);
            }
          }

          if (toolResponse.responseParts) {
            toolResponseParts.push(...toolResponse.responseParts);
          }
        }
        currentMessages = [{ role: 'user', parts: toolResponseParts }];
      } else {
        process.stdout.write('\n'); // Ensure a final newline
        
        // Save checkpoint if requested
        if (config.getSaveCheckpoint() || config.getAutoSave()) {
          await saveConversationCheckpoint(
            config,
            input,
            config.getSaveCheckpoint(),
          );
        }
        
        return;
      }
    }
  } catch (error) {
    console.error(
      parseAndFormatApiError(
        error,
        config.getContentGeneratorConfig()?.authType,
      ),
    );
    throw error;
  } finally {
    consolePatcher.cleanup();
    if (isTelemetrySdkInitialized()) {
      await shutdownTelemetry(config);
    }
  }
}
