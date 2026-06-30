import { BaseTool } from '../base-tool.js';
import type { ToolContext, ToolDefinition, ToolResult } from '../../types/index.js';

export class DriveTool extends BaseTool {
  readonly definition: ToolDefinition = {
    name: 'drive',
    displayName: 'Google Drive',
    description: 'Access and manage documents in Google Drive',
    requiredScopes: [
      'https://www.googleapis.com/auth/drive.readonly',
      'https://www.googleapis.com/auth/drive.file',
    ],
    actions: ['list_recent', 'get_file', 'search', 'share'],
  };

  async execute(
    action: string,
    params: Record<string, unknown>,
    context: ToolContext,
  ): Promise<ToolResult> {
    if (!context.accessToken) return this.notConfigured();

    switch (action) {
      case 'list_recent':
        return this.listRecent(context);
      case 'search':
        return this.search(context, params);
      case 'share':
        return this.share(context, params);
      default:
        return { success: false, error: `Unknown Drive action: ${action}` };
    }
  }

  private async listRecent(_context: ToolContext): Promise<ToolResult> {
    return {
      success: true,
      data: {
        files: [
          { id: 'file_1', name: 'Weekly Report Q2', mimeType: 'application/vnd.google-apps.document', modifiedAt: new Date().toISOString() },
          { id: 'file_2', name: 'Interview Prep Notes', mimeType: 'application/vnd.google-apps.document', modifiedAt: new Date().toISOString() },
        ],
      },
      metadata: { stub: true },
    };
  }

  private async search(
    _context: ToolContext,
    params: Record<string, unknown>,
  ): Promise<ToolResult> {
    return {
      success: true,
      data: { query: params.query, files: [] },
      metadata: { stub: true },
    };
  }

  private async share(
    _context: ToolContext,
    params: Record<string, unknown>,
  ): Promise<ToolResult> {
    return {
      success: true,
      data: { fileId: params.fileId, email: params.email, requiresApproval: true },
      metadata: { stub: true },
    };
  }
}
