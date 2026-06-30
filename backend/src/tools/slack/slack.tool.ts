import { BaseTool } from '../base-tool.js';
import type { ToolContext, ToolDefinition, ToolResult } from '../../types/index.js';

export class SlackTool extends BaseTool {
  readonly definition: ToolDefinition = {
    name: 'slack',
    displayName: 'Slack',
    description: 'Send messages, read channels, and interact with Slack workspace',
    requiredScopes: [
      'channels:read',
      'channels:history',
      'chat:write',
      'users:read',
      'im:history',
    ],
    actions: ['send_message', 'read_channel', 'list_unread', 'post_briefing', 'reply_thread'],
  };

  async execute(
    action: string,
    params: Record<string, unknown>,
    context: ToolContext,
  ): Promise<ToolResult> {
    switch (action) {
      case 'send_message':
        return this.sendMessage(context, params);
      case 'post_briefing':
        return this.postBriefing(context, params);
      case 'reply_thread':
        return this.replyThread(context, params);
      case 'list_unread':
        return this.listUnread(context);
      default:
        return { success: false, error: `Unknown Slack action: ${action}` };
    }
  }

  private async sendMessage(
    _context: ToolContext,
    params: Record<string, unknown>,
  ): Promise<ToolResult> {
    return {
      success: true,
      data: {
        channel: params.channel,
        text: params.text,
        requiresApproval: true,
      },
      metadata: { stub: true },
    };
  }

  private async postBriefing(
    _context: ToolContext,
    params: Record<string, unknown>,
  ): Promise<ToolResult> {
    return {
      success: true,
      data: {
        channel: params.channel,
        blocks: params.blocks,
        posted: false,
        requiresApproval: true,
      },
      metadata: { stub: true },
    };
  }

  private async replyThread(
    _context: ToolContext,
    params: Record<string, unknown>,
  ): Promise<ToolResult> {
    return {
      success: true,
      data: {
        channel: params.channel,
        threadTs: params.threadTs,
        text: params.text,
        requiresApproval: true,
      },
      metadata: { stub: true },
    };
  }

  private async listUnread(_context: ToolContext): Promise<ToolResult> {
    return {
      success: true,
      data: { mentions: 3, dms: 1 },
      metadata: { stub: true },
    };
  }
}
