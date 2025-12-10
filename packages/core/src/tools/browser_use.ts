/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Browser, Page, BrowserContext } from 'playwright';
import { chromium } from 'playwright';
import path from 'node:path';
import { mkdir, rename, readFile, stat } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import type { Config } from '../config/config.js';
import { ToolNames } from './tool-names.js';
import { ToolErrorType } from './tool-error.js';
import type {
  ToolInvocation,
  ToolResult,
} from './tools.js';
import {
  BaseDeclarativeTool,
  BaseToolInvocation,
  Kind,
} from './tools.js';

import { SignJWT } from 'jose';

/**
 * Browser action result interface
 */
export interface BrowserActionResult {
  execution_success?: boolean;
  screenshot?: string;
  logs?: string;
  console_logs?: string;
  execution_logs?: string;
  currentUrl?: string;
  currentMousePosition?: string;
  videoPath?: string; // added
}

interface UploadResult {
  execution_success: boolean;
  videoPath?: string;
  error?: string;
}

const screenshotPrompt = `Here are the action result, console logs and screenshot after the action execution.
Carefully review and decide the next steps to complete the task successfully.`

/**
 * Singleton browser session manager
 */
export class ServerBrowserSession {
  private browser?: Browser;
  private context?: BrowserContext; // added
  private page?: Page;
  private currentMousePosition?: string;
  private static instance?: ServerBrowserSession;

  // recording config/state
  private recordingEnabled = false;         // added
  private recordingDirAbs?: string;         // added (absolute directory)
  private recordingName?: string;           // added (desired filename, optional)
  private lastVideoPath?: string;           // added (resolved saved path)

  private constructor() {}

  static getInstance(): ServerBrowserSession {
    if (!ServerBrowserSession.instance) {
      ServerBrowserSession.instance = new ServerBrowserSession();
    }
    return ServerBrowserSession.instance;
  }

  async launchBrowser(opts?: { record?: boolean; videoDir?: string; videoName?: string }): Promise<BrowserActionResult> {
    console.log('Launching browser...');
    if (this.browser) {
      await this.closeBrowser();
    }

    try {
      this.browser = await chromium.launch({
        args: [
          '--user-agent=Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--disable-web-security',
          '--disable-extensions',
          '--force-device-scale-factor=1',
          '--disable-background-timer-throttling',
          '--disable-backgrounding-occluded-windows',
          '--disable-renderer-backgrounding',
          '--use-gl=swiftshader',
        ],
        headless: true,
      });

      // Configure recording
      this.recordingEnabled = !!opts?.record;
      this.recordingName = opts?.videoName?.trim() || undefined;
      if (this.recordingName && !this.recordingName.endsWith('.webm')) {
        this.recordingName = `${this.recordingName}.webm`;
      }
      if (this.recordingEnabled) {
        const dir = opts?.videoDir?.trim();
        const abs = dir && path.isAbsolute(dir) ? dir : path.resolve(process.cwd(), dir || 'videos');
        await mkdir(abs, { recursive: true });
        this.recordingDirAbs = abs;
        console.log(`[Recording] Enabled. Output dir: ${this.recordingDirAbs}${this.recordingName ? `, name: ${this.recordingName}` : ''}`);
      } else {
        this.recordingDirAbs = undefined;
        this.recordingName = undefined;
      }

      // Create context with optional video
      this.context = await this.browser.newContext({
        viewport: { width: 900, height: 600 },
        deviceScaleFactor: 1,
        screen: { width: 900, height: 600 },
        ignoreHTTPSErrors: true,
        bypassCSP: true,
        ...(this.recordingEnabled && this.recordingDirAbs
          ? { recordVideo: { dir: this.recordingDirAbs, size: { width: 900, height: 600 } } }
          : {}),
      });
      this.page = await this.context.newPage();

      await this.page.addStyleTag({
        content: `
          html, body {
            background-color: white !important;
            min-height: 100vh;
          }
        `,
      });

      const recordNote = this.recordingEnabled
        ? ` with recording to ${this.recordingDirAbs}${this.recordingName ? `/${this.recordingName}` : ''}`
        : '';
      console.log('Browser launched successfully with 900x600 viewport' + recordNote);

      return {
        execution_success: true,
        logs: 'Browser session started successfully with 900x600 viewport' + recordNote,
        execution_logs: 'Browser launched and ready for interaction at 900x600 resolution' + recordNote,
      };
    } catch (_error) {
      const errorMessage = `Failed to launch browser: ${_error instanceof Error ? _error.message : String(_error)}`;
      console.error(`[Error] Exception during Starting browser - ${errorMessage}`);
      return {
        execution_success: false,
        logs: errorMessage,
        execution_logs: errorMessage,
      };
    }
  }

  /* generate access token, jwt token with secret key */
  async generateAccessToken(): Promise<string> {
    const secret = process.env['VIDEO_STORAGE_SECRET_KEY'];
    if (!secret) {
      throw new Error('VIDEO_STORAGE_SECRET_KEY is not set');
    }
    const expiresInSeconds = 3600; // 1 hour
    const payload = {
      sub: randomUUID(),
    };
    const secretKey = new TextEncoder().encode(secret);
    return new SignJWT(payload)
      .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
      .setIssuedAt()
      .setExpirationTime(Math.floor(Date.now() / 1000) + expiresInSeconds)
      .sign(secretKey);
  }


  async uploadToStorage(videoPath: string, videoName: string): Promise<UploadResult> {
    try {
      const accessToken = await this.generateAccessToken();

      const baseUrl = process.env['VIDEO_STORAGE_API_URL'];
      if (!baseUrl) {
        return { execution_success: false, error: 'VIDEO_STORAGE_API_URL is not set' };
      }

      // Read bytes once
      const bytes = await readFile(videoPath);

      // Attempt direct multipart /upload first
      {
        const form = new FormData();
        const blob = new Blob([bytes], { type: 'video/webm' });
        form.append('file', blob, videoName);

        const uploadResponse = await fetch(`${baseUrl}/upload`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${accessToken}` },
          body: form,
        });

        if (uploadResponse.ok) {
          const json = await uploadResponse.json() as { public_url?: string };
          if (json.public_url) {
            return { execution_success: true, videoPath: json.public_url };
          }
          // fall through to signed-url if schema unexpected
        } else {
          const text = await uploadResponse.text().catch(() => '');
          const lower = text.toLowerCase();
          const isBodyParseError =
            uploadResponse.status === 400 && (lower.includes('parse') || lower.includes('parsing'));
          if (!isBodyParseError) {
            return {
              execution_success: false,
              error: `Upload failed (${uploadResponse.status}): ${text}`,
            };
          }
        }
      }

      // Fallback: use signed URL flow to bypass multipart parser
      {
        const signedResp = await fetch(`${baseUrl}/signed-url`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ filename: videoName, content_type: 'video/webm' }),
        });

        if (!signedResp.ok) {
          const text = await signedResp.text().catch(() => '');
          return {
            execution_success: false,
            error: `Signed URL request failed (${signedResp.status}): ${text}`,
          };
        }

        const signedJson = await signedResp.json() as { signed_put_url?: string; public_url?: string };
        if (!signedJson.signed_put_url || !signedJson.public_url) {
          return { execution_success: false, error: 'Invalid signed-url response' };
        }

        const putResp = await fetch(signedJson.signed_put_url, {
          method: 'PUT',
          headers: { 'Content-Type': 'video/webm' },
          body: bytes,
        });
        if (!putResp.ok) {
          const t = await putResp.text().catch(() => '');
          return { execution_success: false, error: `Signed PUT failed (${putResp.status}): ${t}` };
        }

        return { execution_success: true, videoPath: signedJson.public_url };
      }
    } catch (error) {
      console.error('Error uploading video to storage:', error);
      return { execution_success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  async closeBrowser(): Promise<BrowserActionResult> {
    if (this.browser || this.page) {
      console.log('Closing browser...');
      try {
        let tmpVideoPath: string | undefined;
        let finalVideoPath: string | undefined;

        // Close page and get tmp video path
        if (this.page) {
          const v = this.page.video?.();
          await this.page.close();
          if (this.recordingEnabled && v) {
            try {
              tmpVideoPath = await v.path();
            } catch (e) {
              console.warn('[Recording] Failed to obtain video path after page close:', e);
            }
          }
        }

        // Close context to flush video to disk
        await this.context?.close().catch(() => {});

        // Finalize and optionally upload
        if (this.recordingEnabled && tmpVideoPath && this.recordingDirAbs) {
          try {
            if (this.recordingName) {
              const target = path.join(this.recordingDirAbs, this.recordingName);
              await rename(tmpVideoPath, target);
              finalVideoPath = target;
            } else {
              finalVideoPath = tmpVideoPath;
            }

            // Wait briefly until file is non-zero
            if (finalVideoPath) {
              for (let i = 0; i < 10; i++) {
                try {
                  const s = await stat(finalVideoPath);
                  if (s.size > 0) break;
                } catch (_e) {
                  // no-op while file finalizes
                }
                await new Promise((r) => setTimeout(r, 100));
              }
            }

            this.lastVideoPath = finalVideoPath;
            if (process.env['VIDEO_STORAGE_API_URL'] && finalVideoPath) {
              const safeName = this.recordingName || path.basename(finalVideoPath);
              const uploadResult = await this.uploadToStorage(finalVideoPath, safeName);
              if (uploadResult.execution_success && uploadResult.videoPath) {
                this.lastVideoPath = uploadResult.videoPath;
              }
              console.log(`[Recording] Video saved: ${this.lastVideoPath}`);
            } else if (finalVideoPath) {
              console.log(`[Recording] Video saved: ${finalVideoPath}`);
            }
          } catch (e) {
            console.warn('[Recording] Failed to finalize/save/upload video:', e);
          }
        }

        // Close browser
        await this.browser?.close();

        this.browser = undefined;
        this.context = undefined;
        this.page = undefined;
        this.currentMousePosition = undefined;

        const msg = this.lastVideoPath
          ? `Browser session closed successfully. Video saved to: ${this.lastVideoPath}`
          : 'Browser session closed successfully';

        return {
          execution_success: true,
          logs: msg,
          execution_logs: msg,
          videoPath: this.lastVideoPath,
        };
      } catch (_error) {
        const errorMessage = `Error closing browser: ${_error instanceof Error ? _error.message : String(_error)}`;
        console.warn(errorMessage);
        return {
          execution_success: false,
          logs: errorMessage,
          execution_logs: errorMessage,
        };
      }
    }
    return {
      execution_success: true,
      logs: 'Browser was already closed',
      execution_logs: 'No browser to close',
    };
  }

  private async waitTillHTMLStable(timeout: number = 5000): Promise<void> {
    if (!this.page) return;

    const checkDurationMs = 500;
    const maxChecks = timeout / checkDurationMs;
    let lastHTMLSize = 0;
    let checkCounts = 1;
    let countStableSizeIterations = 0;
    const minStableSizeIterations = 3;

    while (checkCounts <= maxChecks) {
      try {
        const html = await this.page.content();
        const currentHTMLSize = html.length;

        console.log(`last: ${lastHTMLSize} <> curr: ${currentHTMLSize}`);

        if (lastHTMLSize !== 0 && currentHTMLSize === lastHTMLSize) {
          countStableSizeIterations++;
        } else {
          countStableSizeIterations = 0;
        }

        if (countStableSizeIterations >= minStableSizeIterations) {
          console.log('Page rendered fully...');
          break;
        }

        lastHTMLSize = currentHTMLSize;
        await new Promise((resolve) => setTimeout(resolve, checkDurationMs));
        checkCounts++;
      } catch (_error) {
        console.warn('Error checking HTML stability:', _error);
        break;
      }
    }
  }

  private async doAction(
    action: () => Promise<string>,
  ): Promise<BrowserActionResult> {
    let executionSuccess = true;
    let screenshot: string | undefined;

    if (!this.page) {
      executionSuccess = false;
      throw new Error(
        'Browser is not launched. This may occur if the browser was automatically closed.',
      );
    }

    const logs: string[] = [];
    let executionLog = '';
    let lastLogTs = Date.now();

    const consoleListener = (msg: { type(): string; text(): string }) => {
      try {
        if (msg.type() === 'log') {
          logs.push(msg.text());
        } else {
          logs.push(`[${msg.type()}] ${msg.text()}`);
        }
        lastLogTs = Date.now();
      } catch (_error) {
        logs.push(
          `[Console Error] unknown console listener error`,
        );
      }
    };

    this.page.on('console', consoleListener);

    try {
      const result = await action();
      executionLog += `\n ${result}`;
    } catch (err) {
      executionLog += `\n [Error] ${err instanceof Error ? err.message : String(err)}`;
      executionSuccess = false;
    }

    // Wait for console inactivity
    try {
      await this.waitForConsoleInactivity(lastLogTs);
    } catch (_error) {
      // Timeout is expected
    }

    try {
      // Ensure page is ready for screenshot
      await this.page.waitForLoadState('domcontentloaded', { timeout: 5000 });

      // Take high-quality screenshot with exact 900x600 dimensions to match viewport
      const screenshotBytes = await this.page.screenshot({
        type: 'png',
        fullPage: false, // Only capture viewport
        clip: { x: 0, y: 0, width: 900, height: 600 }, // Exact viewport dimensions
        omitBackground: false,
      });

      if (screenshotBytes && screenshotBytes.length > 0) {
        const screenshotBase64 = screenshotBytes.toString('base64');
        screenshot = `data:image/png;base64,${screenshotBase64}`;

        // Log screenshot success with dimensions
        console.log(
          `Screenshot captured: 900x600px, ${screenshotBase64.length} chars, data URI length: ${screenshot.length}`,
        );
        executionLog += `\nScreenshot captured at 900x600 resolution (1:1 scale with viewport)`;
      } else {
        console.error('Screenshot capture returned empty buffer');
        executionLog += `\n[Error] Screenshot capture returned empty buffer`;
      }
    } catch (_error) {
      console.error('Screenshot capture failed:', _error);
      executionLog += `\n[Error] Error taking screenshot of the current state of page! ${_error instanceof Error ? _error.message : String(_error)}`;

      // Try alternative screenshot method as fallback
      try {
        console.log('Attempting fallback screenshot method...');
        const fallbackBytes = await this.page.screenshot({
          type: 'png',
          fullPage: false,
        });
        if (fallbackBytes && fallbackBytes.length > 0) {
          const fallbackBase64 = fallbackBytes.toString('base64');
          screenshot = `data:image/png;base64,${fallbackBase64}`;
          console.log(`Fallback screenshot captured: ${fallbackBase64.length} chars`);
          executionLog += `\nFallback screenshot captured successfully`;
        }
      } catch (fallbackError) {
        console.error('Fallback screenshot also failed:', fallbackError);
        executionLog += `\n[Error] Fallback screenshot also failed: ${fallbackError instanceof Error ? fallbackError.message : String(fallbackError)}`;
      }
    }

    try {
      this.page.off('console', consoleListener);
    } catch (_error) {
      console.log(
        `Error removing console listener: ${_error instanceof Error ? _error.message : String(_error)}`,
      );
    }

    if (executionSuccess) {
      executionLog += '\n Action executed Successfully!';
    }

    return {
      execution_success: executionSuccess,
      screenshot,
      console_logs: logs.join('\n'),
      execution_logs: executionLog,
      currentUrl: this.page.url(),
      currentMousePosition: this.currentMousePosition,
      // Also provide the old format for backward compatibility
      logs: logs.join('\n'),
    };
  }

  private async waitForConsoleInactivity(
    lastLogTs: number,
    timeout = 3000,
  ): Promise<void> {
    const startTime = Date.now();
    while (
      Date.now() - lastLogTs < 500 &&
      Date.now() - startTime < timeout
    ) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  async navigateToUrl(url: string): Promise<BrowserActionResult> {
    if (!this.page || !this.browser) {
      const launchResult = await this.launchBrowser({
        record: true,
        videoDir: path.join(process.cwd(), 'videos'),
        videoName: `browser_session_${Date.now()}.webm`,
      });
      if (!launchResult.execution_success) {
        return launchResult;
      }
    }

    return this.doAction(async () => {
      if (!this.page) throw new Error('Page not available');

      let executionLog = '';

      console.log(`Navigating to URL: ${url}`);

      try {
        const response = await this.page.goto(url, {
          timeout: 30000,
          waitUntil: 'domcontentloaded',
        });

        if (!response) {
          executionLog += `\nNavigation failed or no response received for URL: ${url}`;
          throw new Error(
            `Navigation failed or no response received for URL: ${url}`,
          );
        }

        const status = response.status();
        executionLog += `\nNavigated to URL: ${url} (Status: ${status})`;

        if (status >= 400) {
          executionLog += `\nWarning: HTTP status ${status} - page may have errors`;
        }

        // Wait for network to be idle and page to stabilize
        await this.page.waitForLoadState('networkidle', { timeout: 10000 });
        await this.waitTillHTMLStable();

        console.log(`Page navigation completed successfully for: ${url}`);
      } catch (_error) {
        const errorMsg = _error instanceof Error ? _error.message : String(_error);
        console.error(`Navigation error for ${url}:`, errorMsg);
        executionLog += `\nNavigation error: ${errorMsg}`;
        throw _error;
      }

      return executionLog;
    });
  }

  async click(coordinate: string): Promise<BrowserActionResult> {
    const [x, y] = coordinate.split(',').map(Number);

    // Validate coordinates are within viewport bounds
    if (isNaN(x) || isNaN(y)) {
      throw new Error(
        `Invalid coordinates: ${coordinate}. Must be in "x,y" format with valid numbers.`,
      );
    }

    if (x < 0 || x > 900 || y < 0 || y > 600) {
      throw new Error(
        `Coordinates (${x}, ${y}) are outside viewport bounds (0-900, 0-600).`,
      );
    }

    return this.doAction(async () => {
      if (!this.page) throw new Error('Page not available');

      let hasNetworkActivity = false;
      let executionLog = '';

      console.log(`Clicking at coordinates: (${x}, ${y}) within 900x600 viewport`);

      const requestListener = () => {
        hasNetworkActivity = true;
      };

      try {
        this.page.on('request', requestListener);

        // Move mouse to position first, then click
        await this.page.mouse.move(x, y);
        await this.page.mouse.click(x, y);

        this.currentMousePosition = coordinate;
        executionLog += `\nClick Action Performed at exact coordinates (${x}, ${y})`;
        executionLog += `\nViewport: 900x600 pixels, Click position: ${((x / 900) * 100).toFixed(1)}% from left, ${((y / 600) * 100).toFixed(1)}% from top`;

        // Wait a moment for potential page changes
        await new Promise((resolve) => setTimeout(resolve, 500));

        if (hasNetworkActivity) {
          try {
            console.log('Network activity detected, waiting for page to stabilize...');
            await this.page.waitForLoadState('networkidle', { timeout: 7000 });
            await this.waitTillHTMLStable();
            executionLog += '\nPage updated after click';
          } catch (_error) {
            // Navigation timeout is common and not necessarily an error
            console.log('Navigation wait timeout (expected for non-navigating clicks)');
            executionLog += '\nClick completed (no page navigation)';
          }
        } else {
          executionLog += '\nClick completed (no network activity)';
        }

        console.log('Click action completed successfully');
      } catch (_error) {
        const errorMsg = _error instanceof Error ? _error.message : String(_error);
        console.error('Click action failed:', errorMsg);
        executionLog += `\nClick error: ${errorMsg}`;
        throw _error;
      } finally {
        this.page.off('request', requestListener);
      }

      return executionLog;
    });
  }

  async type(text: string): Promise<BrowserActionResult> {
    return this.doAction(async () => {
      if (!this.page) throw new Error('Page not available');

      await this.page.keyboard.type(text);
      return 'Type action performed!';
    });
  }

  async scrollDown(): Promise<BrowserActionResult> {
    return this.doAction(async () => {
      if (!this.page) throw new Error('Page not available');

      await this.page.evaluate("window.scrollBy({top: 400, behavior: 'auto'})");
      await new Promise((resolve) => setTimeout(resolve, 300));
      return 'Scroll down action performed!';
    });
  }

  async scrollUp(): Promise<BrowserActionResult> {
    return this.doAction(async () => {
      if (!this.page) throw new Error('Page not available');

      await this.page.evaluate("window.scrollBy({top: -600, behavior: 'auto'})");
      await new Promise((resolve) => setTimeout(resolve, 300));
      return 'Scroll up action performed!';
    });
  }
}

// ============================================================================
// Browser Launch Tool
// ============================================================================

export interface BrowserLaunchParams {
  record?: boolean;
  videoDir?: string;  // absolute path preferred; defaults to CWD/videos
  videoName?: string; // optional, .webm appended if missing
}

class BrowserLaunchToolInvocation extends BaseToolInvocation<BrowserLaunchParams, ToolResult> {
  constructor(
    params: BrowserLaunchParams,
  ) {
    super(params);
  }

  getDescription(): string {
    return 'Launching browser with 900x600 viewport';
  }

  async execute(): Promise<ToolResult> {
    const session = ServerBrowserSession.getInstance();
    const result = await session.launchBrowser({
      record: this.params.record,
      videoDir: this.params.videoDir,
      videoName: this.params.videoName,
    });

    console.log('[BrowserLaunchTool] Browser launch completed', {
      success: result.execution_success,
    });

    if (!result.execution_success) {
      return {
        llmContent: result.execution_logs || 'Failed to launch browser',
        returnDisplay: result.logs || 'Failed to launch browser',
        error: {
          message: result.logs || 'Failed to launch browser',
          type: ToolErrorType.BROWSER_LAUNCH_ERROR,
        },
      };
    }

    return {
      llmContent: result.execution_logs || 'Browser launched successfully',
      returnDisplay: result.logs || 'Browser launched successfully',
    };
  }
}

export class BrowserLaunchTool extends BaseDeclarativeTool<BrowserLaunchParams, ToolResult> {
  static readonly Name: string = ToolNames.BROWSER_LAUNCH;

  // @ts-expect-error - Required by base class pattern
  constructor(private config: Config) {
    super(
      BrowserLaunchTool.Name,
      'BrowserLaunch',
      'Launches a Playwright-controlled browser instance with a 900x600 viewport. Optionally records the session to a .webm video.',
      Kind.Execute,
      {
        type: 'object',
        properties: {
          record: {
            type: 'boolean',
            description: 'Enable screen recording for the session (video saved on close)',
          },
          videoDir: {
            type: 'string',
            description: 'Directory to save the recording (absolute path preferred). Defaults to "<cwd>/videos".',
          },
          videoName: {
            type: 'string',
            description: 'Filename for the recording (".webm" appended if missing). If omitted, Playwright default name is used.',
          },
        },
        required: [],
      },
      false,
    );
  }

  protected createInvocation(
    params: BrowserLaunchParams,
  ): ToolInvocation<BrowserLaunchParams, ToolResult> {
    return new BrowserLaunchToolInvocation(params);
  }
}

// ============================================================================
// Browser Navigate Tool
// ============================================================================

export interface BrowserNavigateParams {
  url: string;
}

class BrowserNavigateToolInvocation extends BaseToolInvocation<
  BrowserNavigateParams,
  ToolResult
> {
  constructor(
    params: BrowserNavigateParams,
  ) {
    super(params);
  }

  getDescription(): string {
    return `Navigating to ${this.params.url}`;
  }

  async execute(): Promise<ToolResult> {
    const session = ServerBrowserSession.getInstance();
    const result = await session.navigateToUrl(this.params.url);

    console.log('[BrowserNavigateTool] Navigation completed', {
      url: this.params.url,
      success: result.execution_success,
      currentUrl: result.currentUrl,
    });

    const llmContent = [
      `${screenshotPrompt}`,
      `URL: ${this.params.url}`,
      `Status: ${result.execution_success ? 'Success' : 'Failed'}`,
      `Current URL: ${result.currentUrl || 'N/A'}`,
      `Console Logs: ${result.console_logs || '(none)'}`,
      `Execution Details: ${result.execution_logs || ''}`,
    ].join('\n');

    if (!result.execution_success) {
      return {
        llmContent,
        returnDisplay: result.logs || 'Navigation failed',
        error: {
          message: result.logs || 'Navigation failed',
          type: ToolErrorType.BROWSER_NAVIGATE_ERROR,
        },
      };
    }

    // Include screenshot in response
    const llmParts: Array<string | { inlineData: { mimeType: string; data: string } }> = [llmContent];
    if (result.screenshot) {
      llmParts.push({
        inlineData: {
          mimeType: 'image/png',
          data: result.screenshot.split(',')[1], // Remove data:image/png;base64, prefix
        },
      });
    }

    return {
      llmContent: llmParts,
      returnDisplay: result.logs || 'Navigation successful',
    };
  }
}

export class BrowserNavigateTool extends BaseDeclarativeTool<
  BrowserNavigateParams,
  ToolResult
> {
  static readonly Name: string = ToolNames.BROWSER_NAVIGATE;

  // @ts-expect-error - Required by base class pattern
  constructor(private config: Config) {
    super(
      BrowserNavigateTool.Name,
      'BrowserNavigate',
      'Navigates the browser to a specified URL. The browser must be launched first. Returns a screenshot of the page after navigation.',
      Kind.Execute,
      {
        type: 'object',
        properties: {
          url: {
            type: 'string',
            description:
              'The URL to navigate to (e.g., http://localhost:3000, https://example.com, file:///path/to/file.html)',
          },
        },
        required: ['url'],
      },
      false, // output is not markdown
    );
  }

  protected override validateToolParamValues(
    params: BrowserNavigateParams,
  ): string | null {
    if (!params.url || params.url.trim() === '') {
      return 'URL parameter must be non-empty';
    }

    // Basic URL validation
    try {
      new URL(params.url);
    } catch (_error) {
      // Check if it's a file path
      if (!params.url.startsWith('file://') && !params.url.startsWith('http')) {
        return `Invalid URL format: ${params.url}. Must be a valid URL (http://, https://, or file://)`;
      }
    }

    return null;
  }

  protected createInvocation(
    params: BrowserNavigateParams,
  ): ToolInvocation<BrowserNavigateParams, ToolResult> {
    return new BrowserNavigateToolInvocation(params);
  }
}

// ============================================================================
// Browser Click Tool
// ============================================================================

export interface BrowserClickParams {
  coordinate: string;
}

class BrowserClickToolInvocation extends BaseToolInvocation<
  BrowserClickParams,
  ToolResult
> {
  constructor(
    params: BrowserClickParams,
  ) {
    super(params);
  }

  getDescription(): string {
    return `Clicking at coordinates ${this.params.coordinate}`;
  }

  async execute(): Promise<ToolResult> {
    const session = ServerBrowserSession.getInstance();
    const result = await session.click(this.params.coordinate);

    const [x, y] = this.params.coordinate.split(',').map(Number);
    console.log('[BrowserClickTool] Click completed', {
      coordinate: this.params.coordinate,
      success: result.execution_success,
      currentUrl: result.currentUrl,
    });

    const llmContent = [
      `${screenshotPrompt}`,
      `Coordinate: ${this.params.coordinate} (${x}, ${y})`,
      `Status: ${result.execution_success ? 'Success' : 'Failed'}`,
      `Current URL: ${result.currentUrl || 'N/A'}`,
      `Mouse Position: ${result.currentMousePosition || 'N/A'}`,
      `Console Logs: ${result.console_logs || '(none)'}`,
      `Execution Details: ${result.execution_logs || ''}`,
    ].join('\n');

    if (!result.execution_success) {
      return {
        llmContent,
        returnDisplay: result.logs || 'Click failed',
        error: {
          message: result.logs || 'Click failed',
          type: ToolErrorType.BROWSER_CLICK_ERROR,
        },
      };
    }

    // Include screenshot in response
    const llmParts: Array<string | { inlineData: { mimeType: string; data: string } }> = [llmContent];
    if (result.screenshot) {
      llmParts.push({
        inlineData: {
          mimeType: 'image/png',
          data: result.screenshot.split(',')[1],
        },
      });
    }

    return {
      llmContent: llmParts,
      returnDisplay: result.logs || 'Click successful',
    };
  }
}

export class BrowserClickTool extends BaseDeclarativeTool<
  BrowserClickParams,
  ToolResult
> {
  static readonly Name: string = ToolNames.BROWSER_CLICK;

  // @ts-expect-error - Required by base class pattern
  constructor(private config: Config) {
    super(
      BrowserClickTool.Name,
      'BrowserClick',
      'Clicks at a specific x,y coordinate in the browser. The browser window has a resolution of 900x600 pixels. Always click in the center of an element based on coordinates derived from a screenshot. Returns a screenshot after the click.',
      Kind.Execute,
      {
        type: 'object',
        properties: {
          coordinate: {
            type: 'string',
            description:
              'The X and Y coordinates for the click action in "x,y" format (e.g., "450,300"). Coordinates must be within 0-900 for x and 0-600 for y.',
          },
        },
        required: ['coordinate'],
      },
      false, // output is not markdown
    );
  }

  protected override validateToolParamValues(
    params: BrowserClickParams,
  ): string | null {
    if (!params.coordinate || params.coordinate.trim() === '') {
      return 'Coordinate parameter must be non-empty';
    }

    const parts = params.coordinate.split(',');
    if (parts.length !== 2) {
      return 'Coordinate must be in "x,y" format';
    }

    const [x, y] = parts.map(Number);
    if (isNaN(x) || isNaN(y)) {
      return 'Coordinate values must be valid numbers';
    }

    if (x < 0 || x > 900 || y < 0 || y > 600) {
      return `Coordinates (${x}, ${y}) are outside viewport bounds (0-900, 0-600)`;
    }

    return null;
  }

  protected createInvocation(
    params: BrowserClickParams,
  ): ToolInvocation<BrowserClickParams, ToolResult> {
    return new BrowserClickToolInvocation(params);
  }
}

// ============================================================================
// Browser Type Tool
// ============================================================================

export interface BrowserTypeParams {
  text: string;
}

class BrowserTypeToolInvocation extends BaseToolInvocation<
  BrowserTypeParams,
  ToolResult
> {
  constructor(
    params: BrowserTypeParams,
  ) {
    super(params);
  }

  getDescription(): string {
    const preview =
      this.params.text.length > 50
        ? this.params.text.substring(0, 50) + '...'
        : this.params.text;
    return `Typing text: "${preview}"`;
  }

  async execute(): Promise<ToolResult> {
    const session = ServerBrowserSession.getInstance();
    const result = await session.type(this.params.text);

    console.log('[BrowserTypeTool] Type completed', {
      textLength: this.params.text.length,
      success: result.execution_success,
      currentUrl: result.currentUrl,
    });

    const llmContent = [
      `${screenshotPrompt}`,
      `Text: ${this.params.text}`,
      `Status: ${result.execution_success ? 'Success' : 'Failed'}`,
      `Current URL: ${result.currentUrl || 'N/A'}`,
      `Console Logs: ${result.console_logs || '(none)'}`,
      `Execution Details: ${result.execution_logs || ''}`,
    ].join('\n');

    if (!result.execution_success) {
      return {
        llmContent,
        returnDisplay: result.logs || 'Type action failed',
        error: {
          message: result.logs || 'Type action failed',
          type: ToolErrorType.BROWSER_TYPE_ERROR,
        },
      };
    }

    // Include screenshot in response
    const llmParts: Array<string | { inlineData: { mimeType: string; data: string } }> = [llmContent];
    if (result.screenshot) {
      llmParts.push({
        inlineData: {
          mimeType: 'image/png',
          data: result.screenshot.split(',')[1],
        },
      });
    }

    return {
      llmContent: llmParts,
      returnDisplay: result.logs || 'Text typed successfully',
    };
  }
}

export class BrowserTypeTool extends BaseDeclarativeTool<
  BrowserTypeParams,
  ToolResult
> {
  static readonly Name: string = ToolNames.BROWSER_TYPE;

  // @ts-expect-error - Required by base class pattern
  constructor(private config: Config) {
    super(
      BrowserTypeTool.Name,
      'BrowserType',
      'Types a string of text on the keyboard. Use this after clicking on a text field to input text. Returns a screenshot after typing.',
      Kind.Execute,
      {
        type: 'object',
        properties: {
          text: {
            type: 'string',
            description: 'The text string to type',
          },
        },
        required: ['text'],
      },
      false, // output is not markdown
    );
  }

  protected override validateToolParamValues(
    params: BrowserTypeParams,
  ): string | null {
    if (params.text === undefined || params.text === null) {
      return 'Text parameter is required';
    }

    return null;
  }

  protected createInvocation(
    params: BrowserTypeParams,
  ): ToolInvocation<BrowserTypeParams, ToolResult> {
    return new BrowserTypeToolInvocation(params);
  }
}

// ============================================================================
// Browser Scroll Down Tool
// ============================================================================

export interface BrowserScrollDownParams {
  amount: number;
}

class BrowserScrollDownToolInvocation extends BaseToolInvocation<
  BrowserScrollDownParams,
  ToolResult
> {
  constructor(
    params: BrowserScrollDownParams,
  ) {
    super(params);
  }

  getDescription(): string {
    return 'Scrolling down the page';
  }

  async execute(): Promise<ToolResult> {
    const session = ServerBrowserSession.getInstance();
    const result = await session.scrollDown();

    console.log('[BrowserScrollDownTool] Scroll down completed', {
      success: result.execution_success,
      currentUrl: result.currentUrl,
    });

    const llmContent = [
      `${screenshotPrompt}`,
      `Action: Scroll Down`,
      `Status: ${result.execution_success ? 'Success' : 'Failed'}`,
      `Current URL: ${result.currentUrl || 'N/A'}`,
      `Console Logs: ${result.console_logs || '(none)'}`,
      `Execution Details: ${result.execution_logs || ''}`,
    ].join('\n');

    if (!result.execution_success) {
      return {
        llmContent,
        returnDisplay: result.logs || 'Scroll down failed',
        error: {
          message: result.logs || 'Scroll down failed',
          type: ToolErrorType.BROWSER_SCROLL_ERROR,
        },
      };
    }

    // Include screenshot in response
    const llmParts: Array<string | { inlineData: { mimeType: string; data: string } }> = [llmContent];
    if (result.screenshot) {
      llmParts.push({
        inlineData: {
          mimeType: 'image/png',
          data: result.screenshot.split(',')[1],
        },
      });
    }

    return {
      llmContent: llmParts,
      returnDisplay: result.logs || 'Scroll down successful',
    };
  }
}

export class BrowserScrollDownTool extends BaseDeclarativeTool<
  BrowserScrollDownParams,
  ToolResult
> {
  static readonly Name: string = ToolNames.BROWSER_SCROLL_DOWN;

  // @ts-expect-error - Required by base class pattern
  constructor(private config: Config) {
    super(
      BrowserScrollDownTool.Name,
      'BrowserScrollDown',
      'Scrolls down the page by one page height (400 pixels). Returns a screenshot after scrolling.',
      Kind.Execute,
      {
        type: 'object',
        properties: {
          amount: {
            type: 'number',
            description: 'The amount to scroll down',
          },
        },
        required: ['amount'],
      },
      false, // output is not markdown
    );
  }

  protected createInvocation(
    params: BrowserScrollDownParams,
  ): ToolInvocation<BrowserScrollDownParams, ToolResult> {
    return new BrowserScrollDownToolInvocation(params);
  }
}

// ============================================================================
// Browser Scroll Up Tool
// ============================================================================

export interface BrowserScrollUpParams {
  amount: number;
}

class BrowserScrollUpToolInvocation extends BaseToolInvocation<
  BrowserScrollUpParams,
  ToolResult
> {
  constructor(
    params: BrowserScrollUpParams,
  ) {
    super(params);
  }

  getDescription(): string {
    return 'Scrolling up the page';
  }

  async execute(): Promise<ToolResult> {
    const session = ServerBrowserSession.getInstance();
    const result = await session.scrollUp();

    console.log('[BrowserScrollUpTool] Scroll up completed', {
      success: result.execution_success,
      currentUrl: result.currentUrl,
    });

    const llmContent = [
      `${screenshotPrompt}`,
      `Action: Scroll Up`,
      `Status: ${result.execution_success ? 'Success' : 'Failed'}`,
      `Current URL: ${result.currentUrl || 'N/A'}`,
      `Console Logs: ${result.console_logs || '(none)'}`,
      `Execution Details: ${result.execution_logs || ''}`,
    ].join('\n');

    if (!result.execution_success) {
      return {
        llmContent,
        returnDisplay: result.logs || 'Scroll up failed',
        error: {
          message: result.logs || 'Scroll up failed',
          type: ToolErrorType.BROWSER_SCROLL_ERROR,
        },
      };
    }

    // Include screenshot in response
    const llmParts: Array<string | { inlineData: { mimeType: string; data: string } }> = [llmContent];
    if (result.screenshot) {
      llmParts.push({
        inlineData: {
          mimeType: 'image/png',
          data: result.screenshot.split(',')[1],
        },
      });
    }

    return {
      llmContent: llmParts,
      returnDisplay: result.logs || 'Scroll up successful',
    };
  }
}

export class BrowserScrollUpTool extends BaseDeclarativeTool<
  BrowserScrollUpParams,
  ToolResult
> {
  static readonly Name: string = ToolNames.BROWSER_SCROLL_UP;

  // @ts-expect-error - Required by base class pattern
  constructor(private config: Config) {
    super(
      BrowserScrollUpTool.Name,
      'BrowserScrollUp',
      'Scrolls up the page by one page height (600 pixels). Returns a screenshot after scrolling.',
      Kind.Execute,
      {
        type: 'object',
        properties: {
          amount: {
            type: 'number',
            description: 'The amount to scroll up',
          },
        },
        required: ['amount'],
      },
      false, // output is not markdown
    );
  }

  protected createInvocation(
    params: BrowserScrollUpParams,
  ): ToolInvocation<BrowserScrollUpParams, ToolResult> {
    return new BrowserScrollUpToolInvocation(params);
  }
}

// ============================================================================
// Browser Close Tool
// ============================================================================

export interface BrowserCloseParams {
  force?: boolean;
}

class BrowserCloseToolInvocation extends BaseToolInvocation<
  BrowserCloseParams,
  ToolResult
> {
  constructor(
    params: BrowserCloseParams,
  ) {
    super(params);
  }

  getDescription(): string {
    return 'Closing browser';
  }

  async execute(): Promise<ToolResult> {
    const session = ServerBrowserSession.getInstance();
    const result = await session.closeBrowser();

    console.log('[BrowserCloseTool] Browser close completed', {
      success: result.execution_success,
    });

    if (!result.execution_success) {
      return {
        llmContent: result.execution_logs || 'Failed to close browser',
        returnDisplay: result.logs || 'Failed to close browser',
        error: {
          message: result.logs || 'Failed to close browser',
          type: ToolErrorType.BROWSER_CLOSE_ERROR,
        },
      };
    }

    return {
      llmContent: result.execution_logs || 'Browser closed successfully',
      returnDisplay: result.logs || 'Browser closed successfully',
      videoPath: result.videoPath, // Surface the saved video path
    };
  }
}

export class BrowserCloseTool extends BaseDeclarativeTool<
  BrowserCloseParams,
  ToolResult
> {
  static readonly Name: string = ToolNames.BROWSER_CLOSE;

  // @ts-expect-error - Required by base class pattern
  constructor(private config: Config) {
    super(
      BrowserCloseTool.Name,
      'BrowserClose',
      'Closes the Puppeteer-controlled browser instance. This must always be the final browser action.',
      Kind.Execute,
      {
        type: 'object',
        properties: {
          force: {
            type: 'boolean',
            description: 'Whether to force close the browser',
          },
        },
        required: ['force'],
      },
      false, // output is not markdown
    );
  }

  protected createInvocation(
    params: BrowserCloseParams,
  ): ToolInvocation<BrowserCloseParams, ToolResult> {
    return new BrowserCloseToolInvocation(params);
  }
}

