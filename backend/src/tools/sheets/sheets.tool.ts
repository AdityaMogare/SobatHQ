import { BaseTool } from '../base-tool.js';
import type { ToolContext, ToolDefinition, ToolResult } from '../../types/index.js';

export class SheetsTool extends BaseTool {
  readonly definition: ToolDefinition = {
    name: 'sheets',
    displayName: 'Google Sheets',
    description: 'Read and update spreadsheet data for reports and tracking',
    requiredScopes: [
      'https://www.googleapis.com/auth/spreadsheets.readonly',
      'https://www.googleapis.com/auth/spreadsheets',
    ],
    actions: ['read_range', 'write_range', 'get_report', 'append_row'],
  };

  async execute(
    action: string,
    params: Record<string, unknown>,
    context: ToolContext,
  ): Promise<ToolResult> {
    if (!context.accessToken) return this.notConfigured();

    switch (action) {
      case 'get_report':
        return this.getReport(context, params);
      case 'read_range':
        return this.readRange(context, params);
      case 'write_range':
        return this.writeRange(context, params);
      default:
        return { success: false, error: `Unknown Sheets action: ${action}` };
    }
  }

  private async getReport(
    _context: ToolContext,
    params: Record<string, unknown>,
  ): Promise<ToolResult> {
    return {
      success: true,
      data: {
        spreadsheetId: params.spreadsheetId ?? 'weekly_report',
        title: 'Weekly Report',
        status: 'ready',
        summary: 'Report compiled and ready for review.',
        requiresApproval: true,
      },
      metadata: { stub: true },
    };
  }

  private async readRange(
    _context: ToolContext,
    params: Record<string, unknown>,
  ): Promise<ToolResult> {
    return {
      success: true,
      data: { range: params.range, values: [] },
      metadata: { stub: true },
    };
  }

  private async writeRange(
    _context: ToolContext,
    params: Record<string, unknown>,
  ): Promise<ToolResult> {
    return {
      success: true,
      data: { range: params.range, requiresApproval: true },
      metadata: { stub: true },
    };
  }
}
