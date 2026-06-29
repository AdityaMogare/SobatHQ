import { BaseTool } from '../base-tool.js';
import type { ToolContext, ToolDefinition, ToolResult } from '../../types/index.js';

export class GmailTool extends BaseTool {
  readonly definition: ToolDefinition = {
    name: 'gmail',
    displayName: 'Gmail',
    description: 'Read, prioritize, and draft email responses',
    requiredScopes: [
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/gmail.compose',
    ],
    actions: ['list_unread', 'get_thread', 'draft_reply', 'prioritize_inbox', 'search'],
  };

  async execute(
    action: string,
    params: Record<string, unknown>,
    context: ToolContext,
  ): Promise<ToolResult> {
    if (!context.accessToken) return this.notConfigured();

    switch (action) {
      case 'list_unread':
        return this.listUnread(context, params);
      case 'prioritize_inbox':
        return this.prioritizeInbox(context);
      case 'draft_reply':
        return this.draftReply(context, params);
      case 'search':
        return this.search(context, params);
      default:
        return { success: false, error: `Unknown Gmail action: ${action}` };
    }
  }

  private async listUnread(
    _context: ToolContext,
    params: Record<string, unknown>,
  ): Promise<ToolResult> {
    const maxResults = (params.maxResults as number) ?? 20;
    // TODO: Wire to googleapis gmail.users.messages.list
    return {
      success: true,
      data: {
        count: 12,
        messages: Array.from({ length: Math.min(maxResults, 5) }, (_, i) => ({
          id: `msg_${i + 1}`,
          subject: ['Interview invitation', 'Weekly report ready', 'Recruiter follow-up'][i] ?? `Email ${i + 1}`,
          from: ['recruiter@amazon.com', 'hr@company.com', 'recruiter@startup.io'][i] ?? 'sender@example.com',
          snippet: 'Preview of email content...',
          priority: i === 0 ? 'high' : 'medium',
          receivedAt: new Date().toISOString(),
        })),
      },
      metadata: { stub: true },
    };
  }

  private async prioritizeInbox(_context: ToolContext): Promise<ToolResult> {
    return {
      success: true,
      data: {
        prioritized: [
          { id: 'msg_1', subject: 'Interview invitation from Amazon', priority: 'urgent' },
          { id: 'msg_2', subject: 'Recruiter follow-up due today', priority: 'high' },
        ],
      },
      metadata: { stub: true },
    };
  }

  private async draftReply(
    _context: ToolContext,
    params: Record<string, unknown>,
  ): Promise<ToolResult> {
    const messageId = params.messageId as string;
    return {
      success: true,
      data: {
        messageId,
        draft: 'Thank you for reaching out. I am available for an interview on Thursday at 2 PM. Please let me know if that works.',
        requiresApproval: true,
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
      data: { query: params.query, results: [] },
      metadata: { stub: true },
    };
  }
}
