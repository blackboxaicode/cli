/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import path from 'node:path';
import fs from 'node:fs';
import { makeRelative, shortenPath } from '../utils/paths.js';
import type { ToolInvocation, ToolLocation, ToolResult } from './tools.js';
import { BaseDeclarativeTool, BaseToolInvocation, Kind } from './tools.js';
import { ToolNames } from './tool-names.js';
import type { Config } from '../config/config.js';
import { ToolErrorType } from './tool-error.js';
import { generateWorkspacePathError } from './workspace-error-helper.js';

/**
 * Parameters for the ReadDataFile tool
 */
export interface ReadDataFileToolParams {
  /**
   * The absolute path to the data file to read and parse
   */
  absolute_path: string;

  /**
   * Maximum number of rows to DISPLAY in output (optional, default: 100 for display)
   */
  max_rows?: number;
}

/**
 * Parsed data file result
 */
interface ParsedDataResult {
  fileType: string;
  data: unknown;
  summary: string;
  rowCount?: number;
  columnCount?: number;
  columns?: string[];
  sheets?: string[];
  fullDataCount?: number;
}

class ReadDataFileToolInvocation extends BaseToolInvocation<
  ReadDataFileToolParams,
  ToolResult
> {
  constructor(
    private config: Config,
    params: ReadDataFileToolParams,
  ) {
    super(params);
  }

  getDescription(): string {
    const relativePath = makeRelative(
      this.params.absolute_path,
      this.config.getTargetDir(),
    );
    return `Analyzing data file: ${shortenPath(relativePath)}`;
  }

  override toolLocations(): ToolLocation[] {
    return [{ path: this.params.absolute_path }];
  }

  /**
   * Parse CSV file into structured data with comprehensive analysis
   */
  private async parseCSV(content: string): Promise<ParsedDataResult> {
    const lines = content.trim().split('\n');
    if (lines.length === 0) {
      return {
        fileType: 'CSV',
        data: [],
        summary: 'Empty CSV file',
        rowCount: 0,
      };
    }

    // Simple CSV parser (handles basic cases, not production-grade)
    const parseCSVLine = (line: string): string[] => {
      const result: string[] = [];
      let current = '';
      let inQuotes = false;

      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          result.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      result.push(current.trim());
      return result;
    };

    const headers = parseCSVLine(lines[0]);
    const totalRows = lines.length - 1;
    
    // Parse rows, limit display if max_rows is set
    const allDataRows = lines.slice(1);
    const displayMaxRows = this.params.max_rows || 100; // Default to 100 for display

    // Parse data rows
    const allData = allDataRows.map((line) => {
      const values = parseCSVLine(line);
      const row: Record<string, string> = {};
      headers.forEach((header, index) => {
        row[header] = values[index] || '';
      });
      return row;
    });

    // Data to display (limited if max_rows is set)
    const displayData = displayMaxRows ? allData.slice(0, displayMaxRows) : allData;

    const summaryText = displayMaxRows && totalRows > displayMaxRows
      ? `CSV file with ${headers.length} columns and ${totalRows} rows (showing first ${displayMaxRows} rows)`
      : `CSV file with ${headers.length} columns and ${totalRows} rows`;

    return {
      fileType: 'CSV',
      data: displayData,
      summary: summaryText,
      rowCount: totalRows,
      columnCount: headers.length,
      columns: headers,
      fullDataCount: totalRows,
    };
  }

  /**
   * Parse JSON file with comprehensive analysis
   */
  private async parseJSON(content: string): Promise<ParsedDataResult> {
    try {
      const data = JSON.parse(content);
      const isArray = Array.isArray(data);
      const rowCount = isArray ? data.length : undefined;

      let columns: string[] | undefined;
      if (isArray && data.length > 0 && typeof data[0] === 'object') {
        columns = Object.keys(data[0]);
      }

      const displayMaxRows = this.params.max_rows || 100; // Default to 100 for display
      const limitedData = isArray && displayMaxRows ? data.slice(0, displayMaxRows) : data;

      const summaryText = isArray
        ? displayMaxRows && rowCount && rowCount > displayMaxRows
          ? `JSON array with ${rowCount} items${columns ? ` and ${columns.length} fields` : ''} (showing first ${displayMaxRows} items)`
          : `JSON array with ${rowCount} items${columns ? ` and ${columns.length} fields` : ''}`
        : 'JSON object';

      return {
        fileType: 'JSON',
        data: limitedData,
        summary: summaryText,
        rowCount,
        columnCount: columns?.length,
        columns,
        fullDataCount: rowCount,
      };
    } catch (error) {
      throw new Error(
        `Failed to parse JSON: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Parse TXT file (treat as plain text with line-by-line analysis)
   */
  private async parseTXT(content: string): Promise<ParsedDataResult> {
    const lines = content.split('\n');
    const maxRows = this.params.max_rows || 100;
    const limitedLines = lines.slice(0, maxRows);

    return {
      fileType: 'TXT',
      data: limitedLines,
      summary: `Text file with ${lines.length} lines (showing first ${limitedLines.length} lines)`,
      rowCount: lines.length,
    };
  }

  /**
   * Parse XLSX file using xlsx library
   */
  private async parseXLSX(filePath: string): Promise<ParsedDataResult> {
    try {
      // Dynamic import to handle optional dependency - use default export
      const { default: XLSX } = await import('xlsx');
      
      const workbook = XLSX.readFile(filePath);
      const sheetNames = workbook.SheetNames;
      
      if (sheetNames.length === 0) {
        return {
          fileType: 'XLSX',
          data: [],
          summary: 'Empty Excel file with no sheets',
          sheets: [],
        };
      }

      const maxRows = this.params.max_rows || 100;
      
      // Parse all sheets and collect their data
      const allSheetsData: Record<string, unknown[]> = {};
      let totalRows = 0;
      let firstSheetColumns: string[] = [];
      
      for (const sheetName of sheetNames) {
        const worksheet = workbook.Sheets[sheetName];
        
        // Convert to JSON with proper options
        const jsonData = XLSX.utils.sheet_to_json(worksheet, {
          raw: false, // Format numbers and dates
          defval: '', // Default value for empty cells
        });
        
        allSheetsData[sheetName] = jsonData;
        totalRows += jsonData.length;
        
        // Get column names from first sheet's first row
        if (sheetName === sheetNames[0] && jsonData.length > 0 && 
            typeof jsonData[0] === 'object' && jsonData[0] !== null) {
          firstSheetColumns = Object.keys(jsonData[0] as Record<string, unknown>);
        }
      }

      // For the main data output, show limited rows from the first sheet
      const firstSheetName = sheetNames[0];
      const firstSheetData = allSheetsData[firstSheetName] || [];
      const limitedData = firstSheetData.slice(0, maxRows);

      // Create a summary of all sheets
      const sheetsSummary = sheetNames.map(name => 
        `"${name}" (${allSheetsData[name]?.length || 0} rows)`
      ).join(', ');

      return {
        fileType: 'XLSX',
        data: {
          // Primary data from first sheet (limited)
          firstSheet: limitedData,
          // All sheets data (limited per sheet)
          allSheets: Object.fromEntries(
            Object.entries(allSheetsData).map(([name, data]) => [
              name,
              data.slice(0, maxRows)
            ])
          ),
        },
        summary: `Excel file with ${sheetNames.length} sheet(s): ${sheetsSummary}. Total ${totalRows} rows across all sheets. First sheet "${firstSheetName}" has ${firstSheetData.length} rows and ${firstSheetColumns.length} columns (showing first ${limitedData.length} rows).`,
        rowCount: firstSheetData.length,
        columnCount: firstSheetColumns.length,
        columns: firstSheetColumns,
        sheets: sheetNames,
      };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'MODULE_NOT_FOUND' ||
          (error as Error).message?.includes('Cannot find module')) {
        return {
          fileType: 'XLSX',
          data: null,
          summary:
            'XLSX parsing requires the "xlsx" library. Please install it with: npm install xlsx',
        };
      }
      throw new Error(
        `Failed to parse XLSX file: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Parse DOCX file using mammoth library
   */
  private async parseDOCX(filePath: string): Promise<ParsedDataResult> {
    try {
      // Dynamic import to handle optional dependency - use default export
      const { default: mammoth } = await import('mammoth');
      
      const result = await mammoth.extractRawText({ path: filePath });
      const text = result.value;
      
      // Split into paragraphs
      const paragraphs = text
        .split('\n')
        .map((p) => p.trim())
        .filter((p) => p.length > 0);

      const maxRows = this.params.max_rows || 100;
      const limitedParagraphs = paragraphs.slice(0, maxRows);

      return {
        fileType: 'DOCX',
        data: limitedParagraphs,
        summary: `Word document with ${paragraphs.length} paragraphs (showing first ${limitedParagraphs.length})`,
        rowCount: paragraphs.length,
      };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'MODULE_NOT_FOUND' ||
          (error as Error).message?.includes('Cannot find module')) {
        return {
          fileType: 'DOCX',
          data: null,
          summary:
            'DOCX parsing requires the "mammoth" library. Please install it with: npm install mammoth',
        };
      }
      throw new Error(
        `Failed to parse DOCX file: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async execute(): Promise<ToolResult> {
    const filePath = this.params.absolute_path;

    try {
      // Check if file exists
      if (!fs.existsSync(filePath)) {
        return {
          llmContent: `File not found: ${filePath}`,
          returnDisplay: 'File not found',
          error: {
            message: `File not found: ${filePath}`,
            type: ToolErrorType.FILE_NOT_FOUND,
          },
        };
      }

      // Check if it's a directory
      const stats = await fs.promises.stat(filePath);
      if (stats.isDirectory()) {
        return {
          llmContent: `Path is a directory, not a file: ${filePath}`,
          returnDisplay: 'Path is a directory',
          error: {
            message: `Path is a directory: ${filePath}`,
            type: ToolErrorType.TARGET_IS_DIRECTORY,
          },
        };
      }

      // Get file extension
      const ext = path.extname(filePath).toLowerCase();
      const relativePath = makeRelative(filePath, this.config.getTargetDir());

      let result: ParsedDataResult;

      // Parse based on file type
      switch (ext) {
        case '.csv': {
          const content = await fs.promises.readFile(filePath, 'utf-8');
          result = await this.parseCSV(content);
          break;
        }
        case '.json': {
          const content = await fs.promises.readFile(filePath, 'utf-8');
          result = await this.parseJSON(content);
          break;
        }
        case '.txt': {
          const content = await fs.promises.readFile(filePath, 'utf-8');
          result = await this.parseTXT(content);
          break;
        }
        case '.xlsx':
        case '.xls': {
          result = await this.parseXLSX(filePath);
          break;
        }
        case '.docx':
        case '.doc': {
          result = await this.parseDOCX(filePath);
          break;
        }
        case '.pdf': {
          return {
            llmContent: `PDF files are already supported by the read_file tool. Please use read_file instead for: ${relativePath}`,
            returnDisplay: 'Use read_file for PDF files',
          };
        }
        default: {
          return {
            llmContent: `Unsupported file type: ${ext}. Supported types: .csv, .json, .txt, .xlsx, .xls, .docx, .doc`,
            returnDisplay: `Unsupported file type: ${ext}`,
            error: {
              message: `Unsupported file type: ${ext}`,
              type: ToolErrorType.INVALID_TOOL_PARAMS,
            },
          };
        }
      }

      const fileSize = stats.size;
      const fileSizeMB = (fileSize / (1024 * 1024)).toFixed(2);
      const totalRows = result.fullDataCount || result.rowCount || 0;

      // Format the output for the LLM
      const llmContent = `
# Data File: ${relativePath}

## File Information
- **Type**: ${result.fileType}
- **File Size**: ${fileSizeMB} MB
- **Summary**: ${result.summary}
${result.rowCount !== undefined ? `- **Total Rows**: ${result.rowCount}` : ''}
${result.fullDataCount !== undefined && result.fullDataCount !== result.rowCount ? `- **Full Dataset Rows**: ${result.fullDataCount}` : ''}
${result.columnCount !== undefined ? `- **Columns**: ${result.columnCount}` : ''}
${result.columns ? `- **Column Names**: ${result.columns.join(', ')}` : ''}
${result.sheets ? `- **Sheets**: ${result.sheets.join(', ')}` : ''}

## Sample Data (First ${Array.isArray(result.data) ? Math.min(result.data.length, 100) : 'N/A'} rows)

**Note:** This is a sample of the data. For complete analysis, write a Python script to read and analyze the entire file.

\`\`\`json
${JSON.stringify(Array.isArray(result.data) ? result.data.slice(0, 100) : result.data, null, 2)}
\`\`\`

## Recommendations
- Write a Python script to analyze the complete dataset (all ${totalRows} rows)
- Use pandas, numpy, or other data analysis libraries for comprehensive analysis
- Sample from beginning, middle, and end to detect any structure changes
`;

      return {
        llmContent,
        returnDisplay: result.summary,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return {
        llmContent: `Error parsing data file: ${errorMessage}`,
        returnDisplay: `Error: ${errorMessage}`,
        error: {
          message: errorMessage,
          type: ToolErrorType.READ_CONTENT_FAILURE,
        },
      };
    }
  }
}

/**
 * Tool for reading and parsing data files (CSV, JSON, TXT, XLSX, DOCX)
 */
export class ReadDataFileTool extends BaseDeclarativeTool<
  ReadDataFileToolParams,
  ToolResult
> {
  static readonly Name: string = ToolNames.READ_DATA_FILE;

  constructor(private config: Config) {
    super(
      ReadDataFileTool.Name,
      'ReadDataFile',
      `Reads and parses structured data files (CSV, JSON, TXT, XLSX, DOCX, DOC) and returns the parsed data in a structured format. Use this tool to read data files and extract their content. For analysis, write a Python script to process the complete dataset.`,
      Kind.Read,
      {
        properties: {
          absolute_path: {
            description:
              "The absolute path to the data file to read and parse (e.g., '/home/user/project/data.csv'). Supported file types: .csv, .json, .txt, .xlsx, .xls, .docx, .doc. Relative paths are not supported.",
            type: 'string',
          },
          max_rows: {
            description:
              'Optional: Maximum number of rows/items to DISPLAY in the output (default: 100). This only controls how many sample rows are shown. Set higher for more sample data or lower for less.',
            type: 'number',
          },
        },
        required: ['absolute_path'],
        type: 'object',
      },
    );
  }

  protected override validateToolParamValues(
    params: ReadDataFileToolParams,
  ): string | null {
    const filePath = params.absolute_path;

    if (filePath.trim() === '') {
      return "The 'absolute_path' parameter must be non-empty.";
    }

    if (!path.isAbsolute(filePath)) {
      return `File path must be absolute, but was relative: ${filePath}. You must provide an absolute path.`;
    }

    const workspaceContext = this.config.getWorkspaceContext();
    if (!workspaceContext.isPathWithinWorkspace(filePath)) {
      const directories = workspaceContext.getDirectories();
      return generateWorkspacePathError(filePath, directories);
    }

    // Validate file extension
    const ext = path.extname(filePath).toLowerCase();
    const supportedExtensions = ['.csv', '.json', '.txt', '.xlsx', '.xls', '.docx', '.doc'];
    if (!supportedExtensions.includes(ext)) {
      return `Unsupported file type: ${ext}. Supported types: ${supportedExtensions.join(', ')}`;
    }

    if (params.max_rows !== undefined && params.max_rows <= 0) {
      return 'max_rows must be a positive number';
    }

    const fileService = this.config.getFileService();
    if (fileService.shouldGeminiIgnoreFile(params.absolute_path)) {
      return `File path '${filePath}' is ignored by .blackboxignore pattern(s).`;
    }

    return null;
  }

  protected createInvocation(
    params: ReadDataFileToolParams,
  ): ToolInvocation<ReadDataFileToolParams, ToolResult> {
    return new ReadDataFileToolInvocation(this.config, params);
  }
}
