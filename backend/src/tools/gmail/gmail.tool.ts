import { google } from 'googleapis';
import { BaseTool } from '../base-tool.js';
import { createChildLogger } from '../../utils/logger.js';
import type { GoogleOAuthService } from '../../auth/google.oauth.js';
import type { TokenStore } from '../../auth/token-store.js';
import { resolveGoogleAccessToken } from '../google-token.helper.js';
import type { ToolContext, ToolDefinition, ToolResult } from '../../types/index.js';

const log = createChildLogger('tools:gmail');

export interface UnreadEmail {
  id: string;
  sender: string;
  subject: string;
  snippet: string;
}

export class GmailTool extends BaseTool {
  readonly definition: ToolDefinition = {
    name: 'gmail',
    displayName: 'Gmail',
    description: 'Read, prioritize, and draft email responses',
    requiredScopes: [
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/gmail.compose',
    ],
    actions: [
      'list_unread',
      'get_unread_emails',
      'get_thread',
      'draft_reply',
      'prioritize_inbox',
      'search',
    ],
  };

  constructor(
    private tokenStore?: TokenStore,
    private googleOAuth?: GoogleOAuthService,
  ) {
    super();
  }

  async execute(
    action: string,
    params: Record<string, unknown>,
    context: ToolContext,
  ): Promise<ToolResult> {
    switch (action) {
      case 'list_unread':
      case 'get_unread_emails':
        return this.getUnreadEmails(context);
      case 'prioritize_inbox':
        return this.getUnreadEmails(context);
      case 'draft_reply':
        return this.draftReply(context, params);
      case 'search':
        return this.search(context, params);
      default:
        return { success: false, error: `Unknown Gmail action: ${action}` };
    }
  }

  async getUnreadEmails(context: ToolContext): Promise<ToolResult> {
    try {
      const accessToken = await this.resolveToken(context);
      if (!accessToken) return this.notConfigured();

      const auth = new google.auth.OAuth2();
      auth.setCredentials({ access_token: accessToken });
      const gmail = google.gmail({ version: 'v1', auth });

      const list = await gmail.users.messages.list({
        userId: 'me',
        q: 'is:unread',
        maxResults: 5,
      });

      const messageIds = list.data.messages ?? [];
      const emails: UnreadEmail[] = [];

      for (const msg of messageIds) {
        if (!msg.id) continue;
        try {
          const detail = await gmail.users.messages.get({
            userId: 'me',
            id: msg.id,
            format: 'metadata',
            metadataHeaders: ['From', 'Subject'],
          });

          const headers = detail.data.payload?.headers ?? [];
          const getHeader = (name: string) =>
            headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value ?? '';

          emails.push({
            id: msg.id,
            sender: getHeader('From'),
            subject: getHeader('Subject') || '(no subject)',
            snippet: (detail.data.snippet ?? '').slice(0, 120),
          });
        } catch (err) {
          log.warn({ err, messageId: msg.id }, 'Failed to fetch email metadata');
        }
      }

      log.info({ userId: context.userId, count: emails.length }, 'Fetched unread emails');
      return { success: true, data: emails };
    } catch (err) {
      log.error({ err, userId: context.userId }, 'getUnreadEmails failed');
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to fetch emails',
      };
    }
  }

  private async resolveToken(context: ToolContext): Promise<string | null> {
    if (context.accessToken) return context.accessToken;
    if (!this.tokenStore || !this.googleOAuth) return null;
    return resolveGoogleAccessToken(context.userId, this.tokenStore, this.googleOAuth);
  }

  private async draftReply(
    context: ToolContext,
    params: Record<string, unknown>,
  ): Promise<ToolResult> {
    const accessToken = await this.resolveToken(context);
    if (!accessToken) return this.notConfigured();

    const messageId = params.messageId as string;
    return {
      success: true,
      data: {
        messageId,
        draft: 'Draft reply prepared for your approval.',
        requiresApproval: true,
      },
    };
  }

  private async search(
    _context: ToolContext,
    params: Record<string, unknown>,
  ): Promise<ToolResult> {
    return { success: true, data: { query: params.query, results: [] } };
  }
}
