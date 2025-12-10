/**
 * @license
 * Copyright 2025 Blackbox
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useCallback, useEffect } from 'react';
import type { LoadedSettings } from '../../config/settings.js';
import {
  AuthType,
  blackboxOAuth2Events,
  BlackboxOAuth2Event,
} from '@blackbox_ai/blackbox-cli-core';

export interface DeviceAuthorizationInfo {
  verification_uri: string;
  verification_uri_complete: string;
  user_code: string;
  expires_in: number;
}

interface BlackboxAuthState {
  isBlackboxAuthenticating: boolean;
  deviceAuth: DeviceAuthorizationInfo | null;
  authStatus:
    | 'idle'
    | 'polling'
    | 'success'
    | 'error'
    | 'timeout'
    | 'rate_limit';
  authMessage: string | null;
}

export const useBlackboxAuth = (
  settings: LoadedSettings,
  isAuthenticating: boolean,
) => {
  const [blackboxCliAuthState, setBlackboxAuthState] = useState<BlackboxAuthState>({
    isBlackboxAuthenticating: false,
    deviceAuth: null,
    authStatus: 'idle',
    authMessage: null,
  });

  const isBlackboxAuth =
    settings.merged.security?.auth?.selectedType === AuthType.BLACKBOX_OAUTH;

  // Set up event listeners when authentication starts
  useEffect(() => {
    if (!isBlackboxAuth || !isAuthenticating) {
      // Reset state when not authenticating or not Blackbox auth
      setBlackboxAuthState({
        isBlackboxAuthenticating: false,
        deviceAuth: null,
        authStatus: 'idle',
        authMessage: null,
      });
      return;
    }

    setBlackboxAuthState((prev) => ({
      ...prev,
      isBlackboxAuthenticating: true,
      authStatus: 'idle',
    }));

    // Set up event listeners
    const handleDeviceAuth = (deviceAuth: DeviceAuthorizationInfo) => {
      setBlackboxAuthState((prev) => ({
        ...prev,
        deviceAuth: {
          verification_uri: deviceAuth.verification_uri,
          verification_uri_complete: deviceAuth.verification_uri_complete,
          user_code: deviceAuth.user_code,
          expires_in: deviceAuth.expires_in,
        },
        authStatus: 'polling',
      }));
    };

    const handleAuthProgress = (
      status: 'success' | 'error' | 'polling' | 'timeout' | 'rate_limit',
      message?: string,
    ) => {
      setBlackboxAuthState((prev) => ({
        ...prev,
        authStatus: status,
        authMessage: message || null,
      }));
    };

    // Add event listeners
    blackboxOAuth2Events.on(BlackboxOAuth2Event.AuthUri, handleDeviceAuth);
    blackboxOAuth2Events.on(BlackboxOAuth2Event.AuthProgress, handleAuthProgress);

    // Cleanup event listeners when component unmounts or auth finishes
    return () => {
      blackboxOAuth2Events.off(BlackboxOAuth2Event.AuthUri, handleDeviceAuth);
      blackboxOAuth2Events.off(BlackboxOAuth2Event.AuthProgress, handleAuthProgress);
    };
  }, [isBlackboxAuth, isAuthenticating]);

  const cancelBlackboxAuth = useCallback(() => {
    // Emit cancel event to stop polling
    blackboxOAuth2Events.emit(BlackboxOAuth2Event.AuthCancel);

    setBlackboxAuthState({
      isBlackboxAuthenticating: false,
      deviceAuth: null,
      authStatus: 'idle',
      authMessage: null,
    });
  }, []);

  return {
    ...blackboxCliAuthState,
    isBlackboxAuth,
    cancelBlackboxAuth,
  };
};
