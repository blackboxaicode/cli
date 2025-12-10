/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import yargs from 'yargs';
import { addCommand } from './add.js';
import { loadSettings, SettingScope } from '../../config/settings.js';

vi.mock('fs/promises', () => ({
  readFile: vi.fn(),
  writeFile: vi.fn(),
}));

vi.mock('../../config/settings.js', async () => {
  const actual = await vi.importActual('../../config/settings.js');
  return {
    ...actual,
    loadSettings: vi.fn(),
  };
});

const mockedLoadSettings = loadSettings as vi.Mock;

describe('mcp add command', () => {
  let parser: yargs.Argv;
  let mockSetValue: vi.Mock;

  beforeEach(() => {
    vi.resetAllMocks();
    const yargsInstance = yargs([]).command(addCommand);
    parser = yargsInstance;
    mockSetValue = vi.fn();
    mockedLoadSettings.mockReturnValue({
      forScope: () => ({ settings: {} }),
      setValue: mockSetValue,
    });
  });

  it('should add a stdio server to project settings', async () => {
    await parser.parseAsync(
      'add my-server /path/to/server arg1 arg2 -e FOO=bar',
    );

    expect(mockSetValue).toHaveBeenCalledWith(
      SettingScope.Workspace,
      'mcpServers',
      {
        'my-server': {
          command: '/path/to/server',
          args: ['arg1', 'arg2'],
          env: { FOO: 'bar' },
        },
      },
    );
  });

  it('should add an sse server to user settings', async () => {
    await parser.parseAsync(
      'add --transport sse sse-server https://example.com/sse-endpoint --scope user -H "X-API-Key: your-key"',
    );

    expect(mockSetValue).toHaveBeenCalledWith(SettingScope.User, 'mcpServers', {
      'sse-server': {
        url: 'https://example.com/sse-endpoint',
        headers: { 'X-API-Key': 'your-key' },
      },
    });
  });

  it('should add an http server to project settings', async () => {
    await parser.parseAsync(
      'add --transport http http-server https://example.com/mcp -H "Authorization: Bearer your-token"',
    );

    expect(mockSetValue).toHaveBeenCalledWith(
      SettingScope.Workspace,
      'mcpServers',
      {
        'http-server': {
          httpUrl: 'https://example.com/mcp',
          headers: { Authorization: 'Bearer your-token' },
        },
      },
    );
  });

  it('should handle MCP server args with -- separator', async () => {
    await parser.parseAsync(
      'add my-server npx -- -y http://example.com/some-package',
    );

    expect(mockSetValue).toHaveBeenCalledWith(
      SettingScope.Workspace,
      'mcpServers',
      {
        'my-server': {
          command: 'npx',
          args: ['-y', 'http://example.com/some-package'],
        },
      },
    );
  });

  it('should handle unknown options as MCP server args', async () => {
    await parser.parseAsync(
      'add test-server npx -y http://example.com/some-package',
    );

    expect(mockSetValue).toHaveBeenCalledWith(
      SettingScope.Workspace,
      'mcpServers',
      {
        'test-server': {
          command: 'npx',
          args: ['-y', 'http://example.com/some-package'],
        },
      },
    );
  });

  describe('preset configurations', () => {
    it('should add remote-code preset with BLACKBOX_API_KEY', async () => {
      const originalEnv = process.env.BLACKBOX_API_KEY;
      process.env.BLACKBOX_API_KEY = 'test-api-key-123';

      try {
        await parser.parseAsync('add remote-code');

        expect(mockSetValue).toHaveBeenCalledWith(
          SettingScope.Workspace,
          'mcpServers',
          {
            'remote-code': {
              url: 'https://cloud.blackbox.ai/sse',
              headers: { Authorization: 'Bearer test-api-key-123' },
              description: 'Blackbox Remote Code MCP Server',
            },
          },
        );
      } finally {
        if (originalEnv !== undefined) {
          process.env.BLACKBOX_API_KEY = originalEnv;
        } else {
          delete process.env.BLACKBOX_API_KEY;
        }
      }
    });

    it('should fail when remote-code preset is used without BLACKBOX_API_KEY', async () => {
      const originalEnv = process.env.BLACKBOX_API_KEY;
      delete process.env.BLACKBOX_API_KEY;

      const mockExit = vi
        .spyOn(process, 'exit')
        .mockImplementation((() => {}) as never);
      const mockConsoleError = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      try {
        await parser.parseAsync('add remote-code');

        expect(mockConsoleError).toHaveBeenCalledWith(
          expect.stringContaining('BLACKBOX_API_KEY'),
        );
        expect(mockExit).toHaveBeenCalledWith(1);
      } finally {
        mockExit.mockRestore();
        mockConsoleError.mockRestore();
        if (originalEnv !== undefined) {
          process.env.BLACKBOX_API_KEY = originalEnv;
        }
      }
    });

    it('should allow custom options to override preset defaults', async () => {
      const originalEnv = process.env.BLACKBOX_API_KEY;
      process.env.BLACKBOX_API_KEY = 'test-api-key-123';

      try {
        await parser.parseAsync(
          'add remote-code --scope user --description "My custom description"',
        );

        expect(mockSetValue).toHaveBeenCalledWith(
          SettingScope.User,
          'mcpServers',
          {
            'remote-code': {
              url: 'https://mcp.blackbox.ai/sse',
              headers: { Authorization: 'Bearer test-api-key-123' },
              description: 'My custom description',
            },
          },
        );
      } finally {
        if (originalEnv !== undefined) {
          process.env.BLACKBOX_API_KEY = originalEnv;
        } else {
          delete process.env.BLACKBOX_API_KEY;
        }
      }
    });
  });
});
