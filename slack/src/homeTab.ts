import type { KnownBlock, HomeView } from '@slack/types';

export const REFRESH_SYNC_ACTION_ID = 'refresh_sync';

export interface BriefingData {
  summary?: string;
  emailCount?: number;
  emails?: Array<{ subject: string; sender: string; snippet?: string }>;
  meetings?: Array<{ title: string; startTime?: string }>;
  suggestedActions?: Array<{ label: string; description: string }>;
  error?: string;
  loading?: boolean;
  userId?: string;
}

export function buildHomeTabView(data: BriefingData = {}): HomeView {
  const blocks: KnownBlock[] = [
    {
      type: 'header',
      text: { type: 'plain_text', text: '☀️ SobatHQ — Chief of Staff', emoji: true },
    },
    {
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: `_Your AI briefing across Gmail & Calendar · ${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}_`,
        },
      ],
    },
    { type: 'divider' },
  ];

  if (data.loading) {
    blocks.push(
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '*⏳ Agent is compiling your briefing...*\n_Sobat is fetching your emails and calendar with Qwen reasoning._',
        },
      },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: { type: 'plain_text', text: 'Refreshing...', emoji: true },
            action_id: REFRESH_SYNC_ACTION_ID,
            style: 'primary',
            value: 'refresh',
          },
        ],
      },
    );
    return { type: 'home', blocks };
  }

  if (data.error) {
    blocks.push(
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*⚠️ Sync failed*\n${data.error}`,
        },
      },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: '_Connect Google at the link below, then try Refresh Sync again._',
          },
        ],
      },
      buildRefreshButton(),
      { type: 'divider' },
      buildConnectGoogleBlock(data.userId),
    );
    return { type: 'home', blocks };
  }

  // Summary
  if (data.summary) {
    blocks.push({
      type: 'section',
      text: { type: 'mrkdwn', text: `*Briefing*\n${data.summary}` },
    });
    blocks.push({ type: 'divider' });
  }

  // Emails section
  blocks.push({
    type: 'header',
    text: { type: 'plain_text', text: `📬 Unread Emails (${data.emailCount ?? data.emails?.length ?? 0})`, emoji: true },
  });

  if (data.emails?.length) {
    for (const email of data.emails.slice(0, 5)) {
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*${escapeMrkdwn(email.subject)}*\n_From:_ ${escapeMrkdwn(email.sender)}${email.snippet ? `\n>${escapeMrkdwn(email.snippet.slice(0, 80))}` : ''}`,
        },
      });
    }
  } else {
    blocks.push({
      type: 'section',
      text: { type: 'mrkdwn', text: "_No unread emails — you're all caught up!_" },
    });
  }

  blocks.push({ type: 'divider' });

  // Meetings section
  blocks.push({
    type: 'header',
    text: { type: 'plain_text', text: `📅 Today's Meetings (${data.meetings?.length ?? 0})`, emoji: true },
  });

  if (data.meetings?.length) {
    for (const meeting of data.meetings.slice(0, 5)) {
      const time = meeting.startTime
        ? new Date(meeting.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : 'TBD';
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*${escapeMrkdwn(meeting.title)}* · ${time}`,
        },
      });
    }
  } else {
    blocks.push({
      type: 'section',
      text: { type: 'mrkdwn', text: '_No meetings scheduled for today._' },
    });
  }

  // Suggested actions
  if (data.suggestedActions?.length) {
    blocks.push({ type: 'divider' });
    blocks.push({
      type: 'header',
      text: { type: 'plain_text', text: '✅ Suggested Actions', emoji: true },
    });
    for (const action of data.suggestedActions.slice(0, 3)) {
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `• *${escapeMrkdwn(action.label)}*\n  _${escapeMrkdwn(action.description)}_`,
        },
      });
    }
  }

  blocks.push({ type: 'divider' });
  blocks.push(buildRefreshButton());
  blocks.push(buildConnectGoogleBlock(data.userId));

  return { type: 'home', blocks };
}

function buildRefreshButton(): KnownBlock {
  return {
    type: 'actions',
    elements: [
      {
        type: 'button',
        text: { type: 'plain_text', text: '🔄 Refresh Sync', emoji: true },
        action_id: REFRESH_SYNC_ACTION_ID,
        style: 'primary',
        value: 'refresh',
      },
    ],
  };
}

function buildConnectGoogleBlock(userId?: string): KnownBlock {
  const backendUrl = process.env.BACKEND_URL ?? 'http://localhost:3001';
  const authUrl = userId
    ? `${backendUrl}/api/auth/google?userId=${encodeURIComponent(userId)}`
    : `${backendUrl}/api/auth/google`;
  return {
    type: 'context',
    elements: [
      {
        type: 'mrkdwn',
        text: `<${authUrl}|🔗 Connect Google Account> to enable live email & calendar sync`,
      },
    ],
  };
}

function escapeMrkdwn(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function parseOrchestratorResponse(result: {
  data?: {
    summary?: string;
    briefing?: {
      emailCount?: number;
      highlights?: Array<{ title: string; description?: string }>;
      meetings?: Array<{ title: string; description?: string }>;
    };
    suggestedActions?: Array<{ label: string; description: string }>;
  };
  success?: boolean;
  error?: string;
}): BriefingData {
  const data = result.data;
  if (!data) {
    return { error: result.error ?? 'No data returned from orchestrator' };
  }

  return {
    summary: data.summary,
    emailCount: data.briefing?.emailCount,
    emails: data.briefing?.highlights?.map((h) => ({
      subject: h.title,
      sender: h.description?.replace('From: ', '') ?? 'Unknown',
    })),
    meetings: data.briefing?.meetings?.map((m) => ({
      title: m.title,
      startTime: m.description,
    })),
    suggestedActions: data.suggestedActions,
  };
}
