/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useCallback, useEffect } from 'react';
import type { LoadedSettings, SettingScope } from '../../config/settings.js';
import { loadSettings } from '../../config/settings.js';
import { AuthType, type Config } from '@blackbox_ai/blackbox-cli-core';
import {
  clearCachedCredentialFile,
  getErrorMessage,
} from '@blackbox_ai/blackbox-cli-core';
import { runExitCleanup } from '../../utils/cleanup.js';
import { addMcpServer } from '../../commands/mcp/add.js';

export const useAuthCommand = (
  settings: LoadedSettings,
  setAuthError: (error: string | null) => void,
  config: Config,
) => {
  const [isAuthDialogOpen, setIsAuthDialogOpen] = useState(
    settings.merged.security?.auth?.selectedType === undefined,
  );

  const openAuthDialog = useCallback(() => {
    setIsAuthDialogOpen(true);
  }, []);

  const [isAuthenticating, setIsAuthenticating] = useState(false);

  useEffect(() => {
    const authFlow = async () => {
      const authType = settings.merged.security?.auth?.selectedType;
      const providerName = settings.merged.security?.auth?.selectedProvider;
      
      if (isAuthDialogOpen || !authType) {
        return;
      }

      try {
        setIsAuthenticating(true);
        await config.refreshAuth(authType);
        console.log(`Authenticated via "${authType}".`);
        
        // After successful authentication, set up remote-code MCP server if blackbox provider
        if (providerName === 'blackbox') {
          const blackboxApiKey = process.env['BLACKBOX_API_KEY'];
          
          if (blackboxApiKey) {
            try {
              // Check if remote-code server already exists
              const mcpServers = config.getMcpServers() || {};
              if (!mcpServers['remote-code']) {
                await addMcpServer(
                  'remote-code',
                  '__preset__',
                  undefined,
                  {
                    scope: 'project',
                    transport: 'http',
                    env: undefined,
                    header: undefined,
                    timeout: undefined,
                    trust: undefined,
                    description: undefined,
                    includeTools: undefined,
                    excludeTools: undefined,
                  }
                );
                
                // Reload settings to get the updated MCP servers configuration
                const updatedSettings = loadSettings(config.getTargetDir());
                const updatedMcpServers = updatedSettings.merged.mcpServers;
                
                // Update Config's mcpServers property directly
                // This is necessary because Config caches the mcpServers from initialization
                if (updatedMcpServers) {
                  (config as unknown as Omit<Config, 'mcpServers'> & { mcpServers: Record<string, import('@blackbox_ai/blackbox-cli-core').MCPServerConfig> | undefined }).mcpServers = updatedMcpServers;
                }
              }
              
              // Reload the MCP server tools in the current session
              const toolRegistry = config.getToolRegistry();
              if (toolRegistry) {
                await toolRegistry.discoverToolsForServer('remote-code');
                
                // Reinitialize the GeminiClient to pick up the new tools
                // This preserves chat history while updating the tool context
                const geminiClient = config.getGeminiClient();
                if (geminiClient && geminiClient.isInitialized()) {
                  await geminiClient.reinitialize();
                }
              }
            } catch (error) {
              console.error('Failed to configure Remote Code MCP Server:', error);
            }
          }
        }
      } catch (e) {
        setAuthError(`Failed to login. Message: ${getErrorMessage(e)}`);
        openAuthDialog();
      } finally {
        setIsAuthenticating(false);
      }
    };

    void authFlow();
  }, [isAuthDialogOpen, settings, config, setAuthError, openAuthDialog]);

  const handleAuthSelect = useCallback(
    async (authType: AuthType | undefined, scope: SettingScope, providerName?: string) => {
      if (authType) {
        await clearCachedCredentialFile();

        settings.setValue(scope, 'security.auth.selectedType', authType);
        
        // Save provider name if provided
        if (providerName) {
          settings.setValue(scope, 'security.auth.selectedProvider', providerName);
        }
        
        if (
          authType === AuthType.LOGIN_WITH_GOOGLE &&
          config.isBrowserLaunchSuppressed()
        ) {
          runExitCleanup();
          console.log(
            `
----------------------------------------------------------------
Logging in with Google... Please restart Gemini CLI to continue.
----------------------------------------------------------------
            `,
          );
          process.exit(0);
        }
      }
      setIsAuthDialogOpen(false);
      setAuthError(null);
    },
    [settings, setAuthError, config],
  );

  const cancelAuthentication = useCallback(() => {
    setIsAuthenticating(false);
  }, []);

  return {
    isAuthDialogOpen,
    openAuthDialog,
    handleAuthSelect,
    isAuthenticating,
    cancelAuthentication,
  };
};
