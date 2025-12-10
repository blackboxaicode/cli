/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { getErrorMessage, isNodeError } from './errors.js';
import { URL } from 'node:url';

const PRIVATE_IP_RANGES = [
  /^10\./,
  /^127\./,
  /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
  /^192\.168\./,
  /^::1$/,
  /^fc00:/,
  /^fe80:/,
];

export class FetchError extends Error {
  constructor(
    message: string,
    public code?: string,
  ) {
    super(message);
    this.name = 'FetchError';
  }
}

export function isPrivateIp(url: string): boolean {
  try {
    const hostname = new URL(url).hostname;
    return PRIVATE_IP_RANGES.some((range) => range.test(hostname));
  } catch (_e) {
    return false;
  }
}

/**
 * Adds cache-busting query parameter to a URL
 * @param url The original URL
 * @returns URL with cache-busting timestamp parameter
 */
function addCacheBustingParam(url: string): string {
  try {
    const urlObj = new URL(url);
    // Add timestamp to prevent caching
    urlObj.searchParams.set('_t', Date.now().toString());
    return urlObj.toString();
  } catch (_e) {
    // If URL parsing fails, return original URL
    return url;
  }
}

export async function fetchWithTimeout(
  url: string,
  timeout: number,
  options: { cacheBusting?: boolean } = {},
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  // Apply cache-busting if enabled (default: true)
  const cacheBusting = options.cacheBusting !== false;
  const fetchUrl = cacheBusting ? addCacheBustingParam(url) : url;

  // Prepare headers with cache-busting directives
  const headers: HeadersInit = {
    'User-Agent': 'BlackboxAI-CLI/1.0',
  };

  if (cacheBusting) {
    // Add cache-control headers to prevent caching
    headers['Cache-Control'] = 'no-cache, no-store, must-revalidate';
    headers['Pragma'] = 'no-cache';
    headers['Expires'] = '0';
  }

  try {
    const response = await fetch(fetchUrl, {
      signal: controller.signal,
      headers,
    });
    return response;
  } catch (error) {
    if (isNodeError(error) && error.code === 'ABORT_ERR') {
      throw new FetchError(`Request timed out after ${timeout}ms`, 'ETIMEDOUT');
    }
    throw new FetchError(getErrorMessage(error));
  } finally {
    clearTimeout(timeoutId);
  }
}
