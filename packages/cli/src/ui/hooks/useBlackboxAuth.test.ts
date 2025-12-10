/**
 * @license
 * Copyright 2025 Blackbox
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { DeviceAuthorizationInfo } from './useBlackboxAuth.js';
import { useBlackboxAuth } from './useBlackboxAuth.js';
import {
  AuthType,
  blackboxOAuth2Events,
  BlackboxOAuth2Event,
} from '@blackbox_ai/blackbox-cli-core';
import type { LoadedSettings } from '../../config/settings.js';

// Mock the blackboxOAuth2Events
vi.mock('@blackbox_ai/blackbox-cli-core', async () => {
  const actual = await vi.importActual('@blackbox_ai/blackbox-cli-core');
  const mockEmitter = {
    on: vi.fn().mockReturnThis(),
    off: vi.fn().mockReturnThis(),
    emit: vi.fn().mockReturnThis(),
  };
  return {
    ...actual,
    blackboxOAuth2Events: mockEmitter,
    BlackboxOAuth2Event: {
      AuthUri: 'authUri',
      AuthProgress: 'authProgress',
    },
  };
});

const mockBlackboxOAuth2Events = vi.mocked(blackboxOAuth2Events);

describe('useBlackboxAuth', () => {
  const mockDeviceAuth: DeviceAuthorizationInfo = {
    verification_uri: 'https://oauth.blackboxcli.com/device',
    verification_uri_complete: 'https://oauth.blackboxcli.com/device?user_code=ABC123',
    user_code: 'ABC123',
    expires_in: 1800,
  };

  const createMockSettings = (authType: AuthType): LoadedSettings =>
    ({
      merged: {
        security: {
          auth: {
            selectedType: authType,
          },
        },
      },
    }) as LoadedSettings;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should initialize with default state when not Blackbox auth', () => {
    const settings = createMockSettings(AuthType.USE_GEMINI);
    const { result } = renderHook(() => useBlackboxAuth(settings, false));

    expect(result.current).toEqual({
      isBlackboxAuthenticating: false,
      deviceAuth: null,
      authStatus: 'idle',
      authMessage: null,
      isBlackboxAuth: false,
      cancelBlackboxAuth: expect.any(Function),
    });
  });

  it('should initialize with default state when Blackbox auth but not authenticating', () => {
    const settings = createMockSettings(AuthType.BLACKBOX_OAUTH);
    const { result } = renderHook(() => useBlackboxAuth(settings, false));

    expect(result.current).toEqual({
      isBlackboxAuthenticating: false,
      deviceAuth: null,
      authStatus: 'idle',
      authMessage: null,
      isBlackboxAuth: true,
      cancelBlackboxAuth: expect.any(Function),
    });
  });

  it('should set up event listeners when Blackbox auth and authenticating', () => {
    const settings = createMockSettings(AuthType.BLACKBOX_OAUTH);
    renderHook(() => useBlackboxAuth(settings, true));

    expect(mockBlackboxOAuth2Events.on).toHaveBeenCalledWith(
      BlackboxOAuth2Event.AuthUri,
      expect.any(Function),
    );
    expect(mockBlackboxOAuth2Events.on).toHaveBeenCalledWith(
      BlackboxOAuth2Event.AuthProgress,
      expect.any(Function),
    );
  });

  it('should handle device auth event', () => {
    const settings = createMockSettings(AuthType.BLACKBOX_OAUTH);
    let handleDeviceAuth: (deviceAuth: DeviceAuthorizationInfo) => void;

    mockBlackboxOAuth2Events.on.mockImplementation((event, handler) => {
      if (event === BlackboxOAuth2Event.AuthUri) {
        handleDeviceAuth = handler;
      }
      return mockBlackboxOAuth2Events;
    });

    const { result } = renderHook(() => useBlackboxAuth(settings, true));

    act(() => {
      handleDeviceAuth!(mockDeviceAuth);
    });

    expect(result.current.deviceAuth).toEqual(mockDeviceAuth);
    expect(result.current.authStatus).toBe('polling');
    expect(result.current.isBlackboxAuthenticating).toBe(true);
  });

  it('should handle auth progress event - success', () => {
    const settings = createMockSettings(AuthType.BLACKBOX_OAUTH);
    let handleAuthProgress: (
      status: 'success' | 'error' | 'polling' | 'timeout' | 'rate_limit',
      message?: string,
    ) => void;

    mockBlackboxOAuth2Events.on.mockImplementation((event, handler) => {
      if (event === BlackboxOAuth2Event.AuthProgress) {
        handleAuthProgress = handler;
      }
      return mockBlackboxOAuth2Events;
    });

    const { result } = renderHook(() => useBlackboxAuth(settings, true));

    act(() => {
      handleAuthProgress!('success', 'Authentication successful!');
    });

    expect(result.current.authStatus).toBe('success');
    expect(result.current.authMessage).toBe('Authentication successful!');
  });

  it('should handle auth progress event - error', () => {
    const settings = createMockSettings(AuthType.BLACKBOX_OAUTH);
    let handleAuthProgress: (
      status: 'success' | 'error' | 'polling' | 'timeout' | 'rate_limit',
      message?: string,
    ) => void;

    mockBlackboxOAuth2Events.on.mockImplementation((event, handler) => {
      if (event === BlackboxOAuth2Event.AuthProgress) {
        handleAuthProgress = handler;
      }
      return mockBlackboxOAuth2Events;
    });

    const { result } = renderHook(() => useBlackboxAuth(settings, true));

    act(() => {
      handleAuthProgress!('error', 'Authentication failed');
    });

    expect(result.current.authStatus).toBe('error');
    expect(result.current.authMessage).toBe('Authentication failed');
  });

  it('should handle auth progress event - polling', () => {
    const settings = createMockSettings(AuthType.BLACKBOX_OAUTH);
    let handleAuthProgress: (
      status: 'success' | 'error' | 'polling' | 'timeout' | 'rate_limit',
      message?: string,
    ) => void;

    mockBlackboxOAuth2Events.on.mockImplementation((event, handler) => {
      if (event === BlackboxOAuth2Event.AuthProgress) {
        handleAuthProgress = handler;
      }
      return mockBlackboxOAuth2Events;
    });

    const { result } = renderHook(() => useBlackboxAuth(settings, true));

    act(() => {
      handleAuthProgress!('polling', 'Waiting for user authorization...');
    });

    expect(result.current.authStatus).toBe('polling');
    expect(result.current.authMessage).toBe(
      'Waiting for user authorization...',
    );
  });

  it('should handle auth progress event - rate_limit', () => {
    const settings = createMockSettings(AuthType.BLACKBOX_OAUTH);
    let handleAuthProgress: (
      status: 'success' | 'error' | 'polling' | 'timeout' | 'rate_limit',
      message?: string,
    ) => void;

    mockBlackboxOAuth2Events.on.mockImplementation((event, handler) => {
      if (event === BlackboxOAuth2Event.AuthProgress) {
        handleAuthProgress = handler;
      }
      return mockBlackboxOAuth2Events;
    });

    const { result } = renderHook(() => useBlackboxAuth(settings, true));

    act(() => {
      handleAuthProgress!(
        'rate_limit',
        'Too many requests. The server is rate limiting our requests. Please select a different authentication method or try again later.',
      );
    });

    expect(result.current.authStatus).toBe('rate_limit');
    expect(result.current.authMessage).toBe(
      'Too many requests. The server is rate limiting our requests. Please select a different authentication method or try again later.',
    );
  });

  it('should handle auth progress event without message', () => {
    const settings = createMockSettings(AuthType.BLACKBOX_OAUTH);
    let handleAuthProgress: (
      status: 'success' | 'error' | 'polling' | 'timeout' | 'rate_limit',
      message?: string,
    ) => void;

    mockBlackboxOAuth2Events.on.mockImplementation((event, handler) => {
      if (event === BlackboxOAuth2Event.AuthProgress) {
        handleAuthProgress = handler;
      }
      return mockBlackboxOAuth2Events;
    });

    const { result } = renderHook(() => useBlackboxAuth(settings, true));

    act(() => {
      handleAuthProgress!('success');
    });

    expect(result.current.authStatus).toBe('success');
    expect(result.current.authMessage).toBe(null);
  });

  it('should clean up event listeners when auth type changes', () => {
    const blackboxSettings = createMockSettings(AuthType.BLACKBOX_OAUTH);
    const { rerender } = renderHook(
      ({ settings, isAuthenticating }) =>
        useBlackboxAuth(settings, isAuthenticating),
      { initialProps: { settings: blackboxSettings, isAuthenticating: true } },
    );

    // Change to non-Blackbox auth
    const geminiSettings = createMockSettings(AuthType.USE_GEMINI);
    rerender({ settings: geminiSettings, isAuthenticating: true });

    expect(mockBlackboxOAuth2Events.off).toHaveBeenCalledWith(
      BlackboxOAuth2Event.AuthUri,
      expect.any(Function),
    );
    expect(mockBlackboxOAuth2Events.off).toHaveBeenCalledWith(
      BlackboxOAuth2Event.AuthProgress,
      expect.any(Function),
    );
  });

  it('should clean up event listeners when authentication stops', () => {
    const settings = createMockSettings(AuthType.BLACKBOX_OAUTH);
    const { rerender } = renderHook(
      ({ isAuthenticating }) => useBlackboxAuth(settings, isAuthenticating),
      { initialProps: { isAuthenticating: true } },
    );

    // Stop authentication
    rerender({ isAuthenticating: false });

    expect(mockBlackboxOAuth2Events.off).toHaveBeenCalledWith(
      BlackboxOAuth2Event.AuthUri,
      expect.any(Function),
    );
    expect(mockBlackboxOAuth2Events.off).toHaveBeenCalledWith(
      BlackboxOAuth2Event.AuthProgress,
      expect.any(Function),
    );
  });

  it('should clean up event listeners on unmount', () => {
    const settings = createMockSettings(AuthType.BLACKBOX_OAUTH);
    const { unmount } = renderHook(() => useBlackboxAuth(settings, true));

    unmount();

    expect(mockBlackboxOAuth2Events.off).toHaveBeenCalledWith(
      BlackboxOAuth2Event.AuthUri,
      expect.any(Function),
    );
    expect(mockBlackboxOAuth2Events.off).toHaveBeenCalledWith(
      BlackboxOAuth2Event.AuthProgress,
      expect.any(Function),
    );
  });

  it('should reset state when switching from Blackbox auth to another auth type', () => {
    const blackboxSettings = createMockSettings(AuthType.BLACKBOX_OAUTH);
    let handleDeviceAuth: (deviceAuth: DeviceAuthorizationInfo) => void;

    mockBlackboxOAuth2Events.on.mockImplementation((event, handler) => {
      if (event === BlackboxOAuth2Event.AuthUri) {
        handleDeviceAuth = handler;
      }
      return mockBlackboxOAuth2Events;
    });

    const { result, rerender } = renderHook(
      ({ settings, isAuthenticating }) =>
        useBlackboxAuth(settings, isAuthenticating),
      { initialProps: { settings: blackboxSettings, isAuthenticating: true } },
    );

    // Simulate device auth
    act(() => {
      handleDeviceAuth!(mockDeviceAuth);
    });

    expect(result.current.deviceAuth).toEqual(mockDeviceAuth);
    expect(result.current.authStatus).toBe('polling');

    // Switch to different auth type
    const geminiSettings = createMockSettings(AuthType.USE_GEMINI);
    rerender({ settings: geminiSettings, isAuthenticating: true });

    expect(result.current.isBlackboxAuthenticating).toBe(false);
    expect(result.current.deviceAuth).toBe(null);
    expect(result.current.authStatus).toBe('idle');
    expect(result.current.authMessage).toBe(null);
  });

  it('should reset state when authentication stops', () => {
    const settings = createMockSettings(AuthType.BLACKBOX_OAUTH);
    let handleDeviceAuth: (deviceAuth: DeviceAuthorizationInfo) => void;

    mockBlackboxOAuth2Events.on.mockImplementation((event, handler) => {
      if (event === BlackboxOAuth2Event.AuthUri) {
        handleDeviceAuth = handler;
      }
      return mockBlackboxOAuth2Events;
    });

    const { result, rerender } = renderHook(
      ({ isAuthenticating }) => useBlackboxAuth(settings, isAuthenticating),
      { initialProps: { isAuthenticating: true } },
    );

    // Simulate device auth
    act(() => {
      handleDeviceAuth!(mockDeviceAuth);
    });

    expect(result.current.deviceAuth).toEqual(mockDeviceAuth);
    expect(result.current.authStatus).toBe('polling');

    // Stop authentication
    rerender({ isAuthenticating: false });

    expect(result.current.isBlackboxAuthenticating).toBe(false);
    expect(result.current.deviceAuth).toBe(null);
    expect(result.current.authStatus).toBe('idle');
    expect(result.current.authMessage).toBe(null);
  });

  it('should handle cancelBlackboxAuth function', () => {
    const settings = createMockSettings(AuthType.BLACKBOX_OAUTH);
    let handleDeviceAuth: (deviceAuth: DeviceAuthorizationInfo) => void;

    mockBlackboxOAuth2Events.on.mockImplementation((event, handler) => {
      if (event === BlackboxOAuth2Event.AuthUri) {
        handleDeviceAuth = handler;
      }
      return mockBlackboxOAuth2Events;
    });

    const { result } = renderHook(() => useBlackboxAuth(settings, true));

    // Set up some state
    act(() => {
      handleDeviceAuth!(mockDeviceAuth);
    });

    expect(result.current.deviceAuth).toEqual(mockDeviceAuth);

    // Cancel auth
    act(() => {
      result.current.cancelBlackboxAuth();
    });

    expect(result.current.isBlackboxAuthenticating).toBe(false);
    expect(result.current.deviceAuth).toBe(null);
    expect(result.current.authStatus).toBe('idle');
    expect(result.current.authMessage).toBe(null);
  });

  it('should maintain isBlackboxAuth flag correctly', () => {
    // Test with Blackbox OAuth
    const blackboxSettings = createMockSettings(AuthType.BLACKBOX_OAUTH);
    const { result: blackboxResult } = renderHook(() =>
      useBlackboxAuth(blackboxSettings, false),
    );
    expect(blackboxResult.current.isBlackboxAuth).toBe(true);

    // Test with other auth types
    const geminiSettings = createMockSettings(AuthType.USE_GEMINI);
    const { result: geminiResult } = renderHook(() =>
      useBlackboxAuth(geminiSettings, false),
    );
    expect(geminiResult.current.isBlackboxAuth).toBe(false);

    const oauthSettings = createMockSettings(AuthType.LOGIN_WITH_GOOGLE);
    const { result: oauthResult } = renderHook(() =>
      useBlackboxAuth(oauthSettings, false),
    );
    expect(oauthResult.current.isBlackboxAuth).toBe(false);
  });

  it('should set isBlackboxAuthenticating to true when starting authentication with Blackbox auth', () => {
    const settings = createMockSettings(AuthType.BLACKBOX_OAUTH);
    const { result } = renderHook(() => useBlackboxAuth(settings, true));

    expect(result.current.isBlackboxAuthenticating).toBe(true);
    expect(result.current.authStatus).toBe('idle');
  });
});
