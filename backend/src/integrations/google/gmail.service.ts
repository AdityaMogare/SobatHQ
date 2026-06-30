import { google } from 'googleapis';
import type { GoogleOAuthService } from '../../auth/google.oauth.js';
import { createChildLogger } from '../../utils/logger.js';

const log = createChildLogger('integrations:gmail');

export class GmailService {
  constructor(private googleOAuth: GoogleOAuthService) {}

  async listUnread(userId: string, maxResults = 20) {
    const auth = await this.googleOAuth.getAuthenticatedClient(userId);
    const gmail = google.gmail({ version: 'v1', auth });

    const list = await gmail.users.messages.list({
      userId: 'me',
      q: 'is:unread',
      maxResults,
    });

    const messages = await Promise.all(
      (list.data.messages ?? []).slice(0, maxResults).map(async (msg) => {
        const detail = await gmail.users.messages.get({
          userId: 'me',
          id: msg.id!,
          format: 'metadata',
          metadataHeaders: ['From', 'Subject', 'Date'],
        });

        const headers = detail.data.payload?.headers ?? [];
        const getHeader = (name: string) =>
          headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value;

        return {
          id: msg.id,
          threadId: msg.threadId,
          subject: getHeader('Subject') ?? '(no subject)',
          from: getHeader('From') ?? 'unknown',
          snippet: detail.data.snippet,
          receivedAt: getHeader('Date'),
        };
      }),
    );

    log.info({ userId, count: messages.length }, 'Listed unread Gmail messages');
    return { count: list.data.resultSizeEstimate ?? messages.length, messages };
  }

  async draftReply(userId: string, messageId: string, body: string) {
    const auth = await this.googleOAuth.getAuthenticatedClient(userId);
    const gmail = google.gmail({ version: 'v1', auth });

    const original = await gmail.users.messages.get({ userId: 'me', id: messageId, format: 'metadata' });
    const threadId = original.data.threadId;

    const draft = await gmail.users.drafts.create({
      userId: 'me',
      requestBody: {
        message: {
          threadId: threadId ?? undefined,
          raw: Buffer.from(body).toString('base64url'),
        },
      },
    });

    return {
      draftId: draft.data.id,
      messageId,
      requiresApproval: true,
    };
  }
}
