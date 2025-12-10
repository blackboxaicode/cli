/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { MCPServerConfig } from '../config/config.js';
import type { ToolRegistry } from './tool-registry.js';
import type { PromptRegistry } from '../prompts/prompt-registry.js';
import {
  McpClient,
  MCPDiscoveryState,
  populateMcpServerCommand,
} from './mcp-client.js';
import { getErrorMessage } from '../utils/errors.js';
import type { WorkspaceContext } from '../utils/workspaceContext.js';

/**
 * Represents an error that occurred during MCP server discovery
 */
export interface McpServerError {
  serverName: string;
  error: Error;
  userFriendlyMessage: string;
}

/**
 * Manages the lifecycle of multiple MCP clients, including local child processes.
 * This class is responsible for starting, stopping, and discovering tools from
 * a collection of MCP servers defined in the configuration.
 */
export class McpClientManager {
  private clients: Map<string, McpClient> = new Map();
  private readonly mcpServers: Record<string, MCPServerConfig>;
  private readonly mcpServerCommand: string | undefined;
  private readonly toolRegistry: ToolRegistry;
  private readonly promptRegistry: PromptRegistry;
  private readonly debugMode: boolean;
  private readonly workspaceContext: WorkspaceContext;
  private discoveryState: MCPDiscoveryState = MCPDiscoveryState.NOT_STARTED;
  private serverErrors: Map<string, McpServerError> = new Map();

  constructor(
    mcpServers: Record<string, MCPServerConfig>,
    mcpServerCommand: string | undefined,
    toolRegistry: ToolRegistry,
    promptRegistry: PromptRegistry,
    debugMode: boolean,
    workspaceContext: WorkspaceContext,
  ) {
    this.mcpServers = mcpServers;
    this.mcpServerCommand = mcpServerCommand;
    this.toolRegistry = toolRegistry;
    this.promptRegistry = promptRegistry;
    this.debugMode = debugMode;
    this.workspaceContext = workspaceContext;
  }

  /**
   * Creates a user-friendly error message for MCP server connection failures
   */
  private getUserFriendlyErrorMessage(
    serverName: string,
    error: Error,
  ): string {
    const errorMessage = getErrorMessage(error);

    // Handle 401 authentication errors
    if (errorMessage.includes('401') || errorMessage.includes('No authorization provided')) {
      if (serverName === 'remote-code') {
        return `Remote Code MCP server requires authentication. Please set the BLACKBOX_API_KEY environment variable or remove the server with: blackbox mcp remove remote-code`;
      }
      return `MCP server '${serverName}' requires authentication. Please check your credentials or remove the server with: blackbox mcp remove ${serverName}`;
    }

    // Handle connection refused errors
    if (errorMessage.includes('ECONNREFUSED') || errorMessage.includes('Cannot connect')) {
      return `Cannot connect to MCP server '${serverName}'. The server may be offline or the URL may be incorrect.`;
    }

    // Handle network errors
    if (errorMessage.includes('ENOTFOUND') || errorMessage.includes('getaddrinfo')) {
      return `Cannot find MCP server '${serverName}'. Please check the server URL in your settings.`;
    }

    // Handle timeout errors
    if (errorMessage.includes('timeout') || errorMessage.includes('ETIMEDOUT')) {
      return `Connection to MCP server '${serverName}' timed out. The server may be slow or unreachable.`;
    }

    // Generic error with actionable advice
    return `Failed to connect to MCP server '${serverName}'. You can remove it with: blackbox mcp remove ${serverName}`;
  }

  /**
   * Initiates the tool discovery process for all configured MCP servers.
   * It connects to each server, discovers its available tools, and registers
   * them with the `ToolRegistry`.
   */
  async discoverAllMcpTools(): Promise<void> {
    await this.stop();
    this.serverErrors.clear();
    this.discoveryState = MCPDiscoveryState.IN_PROGRESS;
    const servers = populateMcpServerCommand(
      this.mcpServers,
      this.mcpServerCommand,
    );

    const discoveryPromises = Object.entries(servers).map(
      async ([name, config]) => {
        const client = new McpClient(
          name,
          config,
          this.toolRegistry,
          this.promptRegistry,
          this.workspaceContext,
          this.debugMode,
        );
        this.clients.set(name, client);
        try {
          await client.connect();
          await client.discover();
        } catch (error) {
          // Store the error for later display in UI
          const userFriendlyMessage = this.getUserFriendlyErrorMessage(
            name,
            error as Error,
          );
          
          this.serverErrors.set(name, {
            serverName: name,
            error: error as Error,
            userFriendlyMessage,
          });

          // Only log technical details in debug mode
          if (this.debugMode) {
            console.error(
              `[DEBUG] MCP server '${name}' connection failed:`,
              getErrorMessage(error),
            );
          }
        }
      },
    );

    await Promise.all(discoveryPromises);
    this.discoveryState = MCPDiscoveryState.COMPLETED;
  }

  /**
   * Stops all running local MCP servers and closes all client connections.
   * This is the cleanup method to be called on application exit.
   */
  async stop(): Promise<void> {
    const disconnectionPromises = Array.from(this.clients.entries()).map(
      async ([name, client]) => {
        try {
          await client.disconnect();
        } catch (error) {
          console.error(
            `Error stopping client '${name}': ${getErrorMessage(error)}`,
          );
        }
      },
    );

    await Promise.all(disconnectionPromises);
    this.clients.clear();
  }

  getDiscoveryState(): MCPDiscoveryState {
    return this.discoveryState;
  }

  /**
   * Returns all MCP server errors that occurred during discovery
   */
  getServerErrors(): McpServerError[] {
    return Array.from(this.serverErrors.values());
  }

  /**
   * Checks if there are any server errors
   */
  hasServerErrors(): boolean {
    return this.serverErrors.size > 0;
  }

  /**
   * Clears all stored server errors
   */
  clearServerErrors(): void {
    this.serverErrors.clear();
  }
}
