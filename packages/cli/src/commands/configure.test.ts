/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { configureCommand } from './configure/index.js';

describe('configure command', () => {
  beforeEach(() => {
    // Mock process.exit to prevent test termination
    vi.spyOn(process, 'exit').mockImplementation((() => {}) as never);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should have correct command name', () => {
    expect(configureCommand.command).toBe('configure');
  });

  it('should have a description', () => {
    expect(configureCommand.describe).toBeDefined();
    expect(typeof configureCommand.describe).toBe('string');
  });

  it('should have a builder function', () => {
    expect(configureCommand.builder).toBeDefined();
    expect(typeof configureCommand.builder).toBe('function');
  });

  it('should have a handler function', () => {
    expect(configureCommand.handler).toBeDefined();
    expect(typeof configureCommand.handler).toBe('function');
  });
});
