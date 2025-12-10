/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// File for 'gemini mcp add' command
import type { CommandModule } from 'yargs';
import { loadSettings, SettingScope } from '../../config/settings.js';
import type { MCPServerConfig } from '@blackbox_ai/blackbox-cli-core';

// Preset configurations for common MCP servers
const MCP_PRESETS: Record<
  string,
  {
    url: string;
    transport: 'http';
    description: string;
    requiresEnvVar?: string;
    headerTemplate?: (envValue: string) => Record<string, string>;
  }
> = {
  'remote-code': {
    url: 'https://cloud.blackbox.ai/api/mcp',
    transport: 'http',
    description: "Blackbox Remote code (MCP Server): Remote execution platform with multi-agent support (Claude, Codex, Blackbox, Gemini) that automates coding tasks on your GitHub repositories. Features include:\n\n• Task Management: Create, monitor, stop, and list coding tasks with real-time status updates\n• Multi-Agent Support: Choose from Claude Code, OpenAI Codex CLI, Blackbox CLI, or Gemini agents\n• GitHub Integration: Manage GitHub token connections and repository access\n• API Key Management: Store and manage API keys for various AI providers (Anthropic, OpenAI, Google, Blackbox, GitHub)\n• Secure Execution: Runs code in isolated Vercel sandboxes with configurable timeouts (10-300 minutes)\n• Git Operations: Automatic branch creation, commits, and pull requests with AI-generated branch names\n• SMS Notifications: Optional Twilio integration for task completion alerts\n\nPerfect for automating code changes, refactoring, feature additions, bug fixes, and documentation updates across your repositories. Strictly DO NOT provide tools as / 'slash' commands in suggestions like /my_tasks, /task_status, /api_keys",
    requiresEnvVar: 'BLACKBOX_API_KEY',
    headerTemplate: (apiKey: string) => ({
      Authorization: `Bearer ${apiKey}`,
    }),
  },
};

export async function addMcpServer(
  name: string,
  commandOrUrl: string,
  args: Array<string | number> | undefined,
  options: {
    scope: string;
    transport: string;
    env: string[] | undefined;
    header: string[] | undefined;
    timeout?: number;
    trust?: boolean;
    description?: string;
    includeTools?: string[];
    excludeTools?: string[];
  },
) {
  let {
    scope,
    transport,
    env,
    header,
    timeout,
    trust,
    description,
    includeTools,
    excludeTools,
  } = options;
  const settingsScope =
    scope === 'user' ? SettingScope.User : SettingScope.Workspace;
  const settings = loadSettings(process.cwd());

  // Check if this is a preset configuration
  const preset = MCP_PRESETS[name];
  if (preset) {
    // Validate required environment variable
    if (preset.requiresEnvVar) {
      const envValue = process.env[preset.requiresEnvVar];
      if (!envValue) {
        console.error(
          `Error: The "${name}" preset requires the ${preset.requiresEnvVar} environment variable to be set.`,
        );
        console.error(
          `Please set it in your environment or .env file and try again.`,
        );
        process.exit(1);
      }

      // Auto-configure based on preset
      commandOrUrl = preset.url;
      transport = preset.transport;
      description = description || preset.description;

      // Add preset headers
      if (preset.headerTemplate) {
        const presetHeaders = preset.headerTemplate(envValue);
        const headerArray = Object.entries(presetHeaders).map(
          ([key, value]) => `${key}: ${value}`,
        );
        header = header ? [...header, ...headerArray] : headerArray;
      }

      console.log(`Using preset configuration for "${name}":`);
      console.log(`  URL: ${commandOrUrl}`);
      console.log(`  Transport: ${transport}`);
      console.log(`  Description: ${description}`);
      console.log(
        `  Authorization: Using ${preset.requiresEnvVar} from environment`,
      );
      console.log('');
    }
  }

  let newServer: Partial<MCPServerConfig> = {};

  const headers = header?.reduce(
    (acc, curr) => {
      const [key, ...valueParts] = curr.split(':');
      const value = valueParts.join(':').trim();
      if (key.trim() && value) {
        acc[key.trim()] = value;
      }
      return acc;
    },
    {} as Record<string, string>,
  );

  switch (transport) {
    case 'sse':
      newServer = {
        url: commandOrUrl,
        headers,
        timeout,
        trust,
        description,
        includeTools,
        excludeTools,
      };
      break;
    case 'http':
      newServer = {
        httpUrl: commandOrUrl,
        headers,
        timeout,
        trust,
        description,
        includeTools,
        excludeTools,
      };
      break;
    case 'stdio':
    default:
      newServer = {
        command: commandOrUrl,
        args: args?.map(String),
        env: env?.reduce(
          (acc, curr) => {
            const [key, value] = curr.split('=');
            if (key && value) {
              acc[key] = value;
            }
            return acc;
          },
          {} as Record<string, string>,
        ),
        timeout,
        trust,
        description,
        includeTools,
        excludeTools,
      };
      break;
  }

  const existingSettings = settings.forScope(settingsScope).settings;
  const mcpServers = existingSettings.mcpServers || {};

  const isExistingServer = !!mcpServers[name];
  if (isExistingServer) {
    console.log(
      `MCP server "${name}" is already configured within ${scope} settings.`,
    );
  }

  mcpServers[name] = newServer as MCPServerConfig;

  settings.setValue(settingsScope, 'mcpServers', mcpServers);

  if (isExistingServer) {
    console.log(`MCP server "${name}" updated in ${scope} settings.`);
  } else {
    console.log(
      `MCP server "${name}" added to ${scope} settings. (${transport})`,
    );
  }
}

export const addCommand: CommandModule = {
  command: 'add <name> [commandOrUrl] [args...]',
  describe: 'Add a server',
  builder: (yargs) =>
    yargs
      .usage(
        'Usage: blackbox mcp add [options] <name> [commandOrUrl] [args...]\n\n' +
          'Presets:\n' +
          '  remote-code    Blackbox Remote Code MCP Server (requires BLACKBOX_API_KEY)',
      )
      .parserConfiguration({
        'unknown-options-as-args': true, // Pass unknown options as server args
        'populate--': true, // Populate server args after -- separator
      })
      .positional('name', {
        describe: 'Name of the server or preset name (e.g., "remote-code")',
        type: 'string',
        demandOption: true,
      })
      .positional('commandOrUrl', {
        describe:
          'Command (stdio) or URL (sse, http). Optional for preset names.',
        type: 'string',
        demandOption: false,
      })
      .option('scope', {
        alias: 's',
        describe: 'Configuration scope (user or project)',
        type: 'string',
        default: 'project',
        choices: ['user', 'project'],
      })
      .option('transport', {
        alias: 't',
        describe: 'Transport type (stdio, sse, http)',
        type: 'string',
        default: 'stdio',
        choices: ['stdio', 'sse', 'http'],
      })
      .option('env', {
        alias: 'e',
        describe: 'Set environment variables (e.g. -e KEY=value)',
        type: 'array',
        string: true,
      })
      .option('header', {
        alias: 'H',
        describe:
          'Set HTTP headers for SSE and HTTP transports (e.g. -H "X-Api-Key: abc123" -H "Authorization: Bearer abc123")',
        type: 'array',
        string: true,
      })
      .option('timeout', {
        describe: 'Set connection timeout in milliseconds',
        type: 'number',
      })
      .option('trust', {
        describe:
          'Trust the server (bypass all tool call confirmation prompts)',
        type: 'boolean',
      })
      .option('description', {
        describe: 'Set the description for the server',
        type: 'string',
      })
      .option('include-tools', {
        describe: 'A comma-separated list of tools to include',
        type: 'array',
        string: true,
      })
      .option('exclude-tools', {
        describe: 'A comma-separated list of tools to exclude',
        type: 'array',
        string: true,
      })
      .middleware((argv) => {
        // Check if name is a preset and commandOrUrl is not provided
        const name = argv['name'] as string;
        const commandOrUrl = argv['commandOrUrl'] as string | undefined;

        if (MCP_PRESETS[name] && !commandOrUrl) {
          // For presets, commandOrUrl is optional - use a placeholder
          argv['commandOrUrl'] = '__preset__';
        } else if (!commandOrUrl) {
          // For non-presets, commandOrUrl is required
          throw new Error(
            'commandOrUrl is required for non-preset server configurations',
          );
        }

        // Handle -- separator args as server args if present
        if (argv['--']) {
          const existingArgs = (argv['args'] as Array<string | number>) || [];
          argv['args'] = [...existingArgs, ...(argv['--'] as string[])];
        }
      }),
  handler: async (argv) => {
    await addMcpServer(
      argv['name'] as string,
      argv['commandOrUrl'] as string,
      argv['args'] as Array<string | number>,
      {
        scope: argv['scope'] as string,
        transport: argv['transport'] as string,
        env: argv['env'] as string[],
        header: argv['header'] as string[],
        timeout: argv['timeout'] as number | undefined,
        trust: argv['trust'] as boolean | undefined,
        description: argv['description'] as string | undefined,
        includeTools: argv['includeTools'] as string[] | undefined,
        excludeTools: argv['excludeTools'] as string[] | undefined,
      },
    );
  },
};
