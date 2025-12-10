/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect } from 'vitest';
import {
  isBlackboxQuotaExceededError,
  isBlackboxThrottlingError,
  isProQuotaExceededError,
  isGenericQuotaExceededError,
  isApiError,
  isStructuredError,
  type ApiError,
} from './quotaErrorDetection.js';

describe('quotaErrorDetection', () => {
  describe('isBlackboxQuotaExceededError', () => {
    it('should detect insufficient_quota error message', () => {
      const error = new Error('insufficient_quota');
      expect(isBlackboxQuotaExceededError(error)).toBe(true);
    });

    it('should detect free allocated quota exceeded error message', () => {
      const error = new Error('Free allocated quota exceeded.');
      expect(isBlackboxQuotaExceededError(error)).toBe(true);
    });

    it('should detect quota exceeded error message', () => {
      const error = new Error('quota exceeded');
      expect(isBlackboxQuotaExceededError(error)).toBe(true);
    });

    it('should detect quota exceeded in string error', () => {
      const error = 'insufficient_quota';
      expect(isBlackboxQuotaExceededError(error)).toBe(true);
    });

    it('should detect quota exceeded in structured error', () => {
      const error = { message: 'Free allocated quota exceeded.', status: 429 };
      expect(isBlackboxQuotaExceededError(error)).toBe(true);
    });

    it('should detect quota exceeded in API error', () => {
      const error: ApiError = {
        error: {
          code: 429,
          message: 'insufficient_quota',
          status: 'RESOURCE_EXHAUSTED',
          details: [],
        },
      };
      expect(isBlackboxQuotaExceededError(error)).toBe(true);
    });

    it('should not detect throttling errors as quota exceeded', () => {
      const error = new Error('requests throttling triggered');
      expect(isBlackboxQuotaExceededError(error)).toBe(false);
    });

    it('should not detect unrelated errors', () => {
      const error = new Error('Network error');
      expect(isBlackboxQuotaExceededError(error)).toBe(false);
    });
  });

  describe('isBlackboxThrottlingError', () => {
    it('should detect throttling error with 429 status', () => {
      const error = { message: 'throttling', status: 429 };
      expect(isBlackboxThrottlingError(error)).toBe(true);
    });

    it('should detect requests throttling triggered with 429 status', () => {
      const error = { message: 'requests throttling triggered', status: 429 };
      expect(isBlackboxThrottlingError(error)).toBe(true);
    });

    it('should detect rate limit error with 429 status', () => {
      const error = { message: 'rate limit exceeded', status: 429 };
      expect(isBlackboxThrottlingError(error)).toBe(true);
    });

    it('should detect too many requests with 429 status', () => {
      const error = { message: 'too many requests', status: 429 };
      expect(isBlackboxThrottlingError(error)).toBe(true);
    });

    it('should detect throttling in string error', () => {
      const error = 'throttling';
      expect(isBlackboxThrottlingError(error)).toBe(true);
    });

    it('should detect throttling in structured error with 429', () => {
      const error = { message: 'requests throttling triggered', status: 429 };
      expect(isBlackboxThrottlingError(error)).toBe(true);
    });

    it('should detect throttling in API error with 429', () => {
      const error: ApiError = {
        error: {
          code: 429,
          message: 'throttling',
          status: 'RESOURCE_EXHAUSTED',
          details: [],
        },
      };
      expect(isBlackboxThrottlingError(error)).toBe(true);
    });

    it('should not detect throttling without 429 status in structured error', () => {
      const error = { message: 'throttling', status: 500 };
      expect(isBlackboxThrottlingError(error)).toBe(false);
    });

    it('should not detect quota exceeded as throttling', () => {
      const error = { message: 'insufficient_quota', status: 429 };
      expect(isBlackboxThrottlingError(error)).toBe(false);
    });

    it('should not detect unrelated errors as throttling', () => {
      const error = { message: 'Network error', status: 500 };
      expect(isBlackboxThrottlingError(error)).toBe(false);
    });
  });

  describe('isProQuotaExceededError', () => {
    it('should detect Gemini Pro quota exceeded error', () => {
      const error = new Error(
        "Quota exceeded for quota metric 'Gemini 2.5 Pro Requests'",
      );
      expect(isProQuotaExceededError(error)).toBe(true);
    });

    it('should detect Gemini preview Pro quota exceeded error', () => {
      const error = new Error(
        "Quota exceeded for quota metric 'Gemini 2.5-preview Pro Requests'",
      );
      expect(isProQuotaExceededError(error)).toBe(true);
    });

    it('should not detect non-Pro quota errors', () => {
      const error = new Error(
        "Quota exceeded for quota metric 'Gemini 1.5 Flash Requests'",
      );
      expect(isProQuotaExceededError(error)).toBe(false);
    });
  });

  describe('isGenericQuotaExceededError', () => {
    it('should detect generic quota exceeded error', () => {
      const error = new Error('Quota exceeded for quota metric');
      expect(isGenericQuotaExceededError(error)).toBe(true);
    });

    it('should not detect non-quota errors', () => {
      const error = new Error('Network error');
      expect(isGenericQuotaExceededError(error)).toBe(false);
    });
  });

  describe('type guards', () => {
    describe('isApiError', () => {
      it('should detect valid API error', () => {
        const error: ApiError = {
          error: {
            code: 429,
            message: 'test error',
            status: 'RESOURCE_EXHAUSTED',
            details: [],
          },
        };
        expect(isApiError(error)).toBe(true);
      });

      it('should not detect invalid API error', () => {
        const error = { message: 'test error' };
        expect(isApiError(error)).toBe(false);
      });
    });

    describe('isStructuredError', () => {
      it('should detect valid structured error', () => {
        const error = { message: 'test error', status: 429 };
        expect(isStructuredError(error)).toBe(true);
      });

      it('should not detect invalid structured error', () => {
        const error = { code: 429 };
        expect(isStructuredError(error)).toBe(false);
      });
    });
  });
});
