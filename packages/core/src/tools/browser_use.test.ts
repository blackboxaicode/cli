/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  BrowserLaunchTool,
  BrowserNavigateTool,
  BrowserClickTool,
  BrowserTypeTool,
  BrowserScrollDownTool,
  BrowserScrollUpTool,
  BrowserCloseTool,
  ServerBrowserSession,
} from './browser_use.js';
import type { Config } from '../config/config.js';

describe('Browser Tools', () => {
  let mockConfig: Config;

  beforeEach(() => {
    mockConfig = {
      getTargetDir: () => '/test/dir',
      getDebugMode: () => false,
    } as unknown as Config;
  });

  describe('BrowserLaunchTool', () => {
    it('should create tool with correct name and schema', () => {
      const tool = new BrowserLaunchTool(mockConfig);
      expect(tool.name).toBe('browser_launch');
      expect(tool.displayName).toBe('BrowserLaunch');
      expect(tool.schema.parametersJsonSchema).toHaveProperty('type', 'object');
    });

    it('should build invocation successfully', () => {
      const tool = new BrowserLaunchTool(mockConfig);
      const invocation = tool.build({});
      expect(invocation).toBeDefined();
      expect(invocation.getDescription()).toBe('Launching browser with 900x600 viewport');
    });
  });

  describe('BrowserNavigateTool', () => {
    it('should create tool with correct name and schema', () => {
      const tool = new BrowserNavigateTool(mockConfig);
      expect(tool.name).toBe('browser_navigate');
      expect(tool.displayName).toBe('BrowserNavigate');
    });

    it('should validate URL parameter', () => {
      const tool = new BrowserNavigateTool(mockConfig);
      expect(() => tool.build({ url: '' })).toThrow('URL parameter must be non-empty');
    });

    it('should build invocation with valid URL', () => {
      const tool = new BrowserNavigateTool(mockConfig);
      const invocation = tool.build({ url: 'https://example.com' });
      expect(invocation).toBeDefined();
      expect(invocation.getDescription()).toBe('Navigating to https://example.com');
    });
  });

  describe('BrowserClickTool', () => {
    it('should create tool with correct name and schema', () => {
      const tool = new BrowserClickTool(mockConfig);
      expect(tool.name).toBe('browser_click');
      expect(tool.displayName).toBe('BrowserClick');
    });

    it('should validate coordinate format', () => {
      const tool = new BrowserClickTool(mockConfig);
      expect(() => tool.build({ coordinate: 'invalid' })).toThrow('Coordinate must be in "x,y" format');
    });

    it('should validate coordinate bounds', () => {
      const tool = new BrowserClickTool(mockConfig);
      expect(() => tool.build({ coordinate: '1000,500' })).toThrow('outside viewport bounds');
      expect(() => tool.build({ coordinate: '500,700' })).toThrow('outside viewport bounds');
    });

    it('should build invocation with valid coordinates', () => {
      const tool = new BrowserClickTool(mockConfig);
      const invocation = tool.build({ coordinate: '450,300' });
      expect(invocation).toBeDefined();
      expect(invocation.getDescription()).toBe('Clicking at coordinates 450,300');
    });
  });

  describe('BrowserTypeTool', () => {
    it('should create tool with correct name and schema', () => {
      const tool = new BrowserTypeTool(mockConfig);
      expect(tool.name).toBe('browser_type');
      expect(tool.displayName).toBe('BrowserType');
    });

    it('should validate text parameter', () => {
      const tool = new BrowserTypeTool(mockConfig);
      // Empty string is allowed, but undefined should be caught by schema validation
      const invocation = tool.build({ text: '' });
      expect(invocation).toBeDefined();
    });

    it('should build invocation with valid text', () => {
      const tool = new BrowserTypeTool(mockConfig);
      const invocation = tool.build({ text: 'Hello World' });
      expect(invocation).toBeDefined();
      expect(invocation.getDescription()).toBe('Typing text: "Hello World"');
    });

    it('should truncate long text in description', () => {
      const tool = new BrowserTypeTool(mockConfig);
      const longText = 'a'.repeat(100);
      const invocation = tool.build({ text: longText });
      expect(invocation.getDescription()).toContain('...');
    });
  });

  describe('BrowserScrollDownTool', () => {
    it('should create tool with correct name and schema', () => {
      const tool = new BrowserScrollDownTool(mockConfig);
      expect(tool.name).toBe('browser_scroll_down');
      expect(tool.displayName).toBe('BrowserScrollDown');
    });

    it('should build invocation successfully', () => {
      const tool = new BrowserScrollDownTool(mockConfig);
      const invocation = tool.build({ amount: 100 });
      expect(invocation).toBeDefined();
      expect(invocation.getDescription()).toBe('Scrolling down the page');
    });
  });

  describe('BrowserScrollUpTool', () => {
    it('should create tool with correct name and schema', () => {
      const tool = new BrowserScrollUpTool(mockConfig);
      expect(tool.name).toBe('browser_scroll_up');
      expect(tool.displayName).toBe('BrowserScrollUp');
    });

    it('should build invocation successfully', () => {
      const tool = new BrowserScrollUpTool(mockConfig);
      const invocation = tool.build({ amount: 100 });
      expect(invocation).toBeDefined();
      expect(invocation.getDescription()).toBe('Scrolling up the page');
    });
  });

  describe('BrowserCloseTool', () => {
    it('should create tool with correct name and schema', () => {
      const tool = new BrowserCloseTool(mockConfig);
      expect(tool.name).toBe('browser_close');
      expect(tool.displayName).toBe('BrowserClose');
    });

    it('should build invocation successfully', () => {
      const tool = new BrowserCloseTool(mockConfig);
      const invocation = tool.build({ force: false });
      expect(invocation).toBeDefined();
      expect(invocation.getDescription()).toBe('Closing browser');
    });
  });

  describe('ServerBrowserSession', () => {
    it('should be a singleton', () => {
      const instance1 = ServerBrowserSession.getInstance();
      const instance2 = ServerBrowserSession.getInstance();
      expect(instance1).toBe(instance2);
    });
  });
});
