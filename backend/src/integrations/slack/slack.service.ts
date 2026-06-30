import type { SlackOAuthService } from '../../auth/slack.oauth.js';
import { createChildLogger } from '../../utils/logger.js';

const log = createChildLogger('integrations:slack');

interface SlackApiResponse {
  ok: boolean;
  error?: string;
}

export class SlackIntegrationService {
  constructor(private slackOAuth: SlackOAuthService) {}

  private async apiCall<T extends SlackApiResponse>(
    userId: string,
    method: string,
    body?: Record<string, string>,
  ): Promise<T> {
    const token = await this.slackOAuth.getAccessToken(userId);
    const response = await fetch(`https://slack.com/api/${method}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body ? new URLSearchParams(body) : undefined,
    });

    const data = (await response.json()) as T;
    if (!data.ok) {
      throw new Error(`Slack API error (${method}): ${data.error}`);
    }
    return data;
  }

  async listChannels(userId: string) {
    const data = await this.apiCall<SlackApiResponse & { channels?: Array<{ id: string; name: string }> }>(
      userId,
      'conversations.list',
      { types: 'public_channel,private_channel', limit: '50' },
    );
    log.info({ userId, count: data.channels?.length }, 'Listed Slack channels');
    return { channels: data.channels ?? [] };
  }

  async sendMessage(userId: string, channel: string, text: string) {
    const data = await this.apiCall<SlackApiResponse & { ts?: string; channel?: string }>(
      userId,
      'chat.postMessage',
      { channel, text },
    );
    return {
      channel: data.channel,
      ts: data.ts,
      requiresApproval: true,
    };
  }

  async postBriefing(userId: string, channel: string, text: string) {
    return this.sendMessage(userId, channel, text);
  }
}
