import 'dotenv/config';
import { App } from '@slack/bolt';
import {
  buildHomeTabView,
  parseOrchestratorResponse,
  REFRESH_SYNC_ACTION_ID,
  type BriefingData,
} from './homeTab.js';

const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  socketMode: !!process.env.SLACK_APP_TOKEN,
  appToken: process.env.SLACK_APP_TOKEN,
  port: Number(process.env.SLACK_PORT ?? 3002),
});

const BACKEND_URL = process.env.BACKEND_URL ?? 'http://localhost:3001';
const ORCHESTRATE_TIMEOUT_MS = 35_000;

async function callOrchestrator(userId: string, message: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ORCHESTRATE_TIMEOUT_MS);

  try {
    const res = await fetch(`${BACKEND_URL}/api/orchestrate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        message,
        context: { source: 'slack', channelId: 'app_home' },
      }),
      signal: controller.signal,
    });

    const json = await res.json();
    if (!res.ok) {
      throw new Error(json.error ?? `Backend returned ${res.status}`);
    }
    return json;
  } finally {
    clearTimeout(timeout);
  }
}

async function publishHomeTab(
  client: import('@slack/web-api').WebClient,
  userId: string,
  data: BriefingData = {},
) {
  await client.views.publish({
    user_id: userId,
    view: buildHomeTabView(data),
  });
}

// ─── App Home: render on open ───────────────────────────────────────────────

app.event('app_home_opened', async ({ event, client }) => {
  try {
    await publishHomeTab(client, event.user, { userId: event.user });
  } catch (err) {
    console.error('Failed to render App Home:', err);
  }
});

// ─── Refresh Sync: loading → orchestrator → results ───────────────────────

app.action(REFRESH_SYNC_ACTION_ID, async ({ ack, body, client }) => {
  await ack();

  const userId = body.user.id;

  try {
    await publishHomeTab(client, userId, { loading: true, userId });

    const result = await callOrchestrator(userId, "What's important today? Refresh my briefing.");
    const briefingData = parseOrchestratorResponse(result);

    await publishHomeTab(client, userId, { ...briefingData, userId });
  } catch (err) {
    console.error('Refresh sync failed:', err);
    const message =
      err instanceof Error
        ? err.name === 'AbortError'
          ? 'Request timed out. Please try again.'
          : err.message
        : 'Unknown error';

    await publishHomeTab(client, userId, {
      error: message.includes('not connected') || message.includes('OAuth')
        ? 'Google account not connected. Connect below, then refresh.'
        : message,
      userId,
    });
  }
});

// ─── Legacy: slash command & mentions ───────────────────────────────────────

function formatBriefingResponse(data: {
  summary?: string;
  suggestedActions?: Array<{ label: string; description: string }>;
}) {
  const lines = ['*SobatHQ Daily Briefing*\n'];
  if (data.summary) lines.push(data.summary);
  if (data.suggestedActions?.length) {
    lines.push('\n*Suggested actions:*');
    for (const action of data.suggestedActions) {
      lines.push(`• *${action.label}* — ${action.description}`);
    }
  }
  return lines.join('\n');
}

app.command('/sobat', async ({ command, ack, respond }) => {
  await ack();
  const query = command.text.trim() || "what's important today";

  try {
    const result = await callOrchestrator(command.user_id, query);
    const text = formatBriefingResponse(result.data ?? result);
    await respond({ text, response_type: 'ephemeral' });
  } catch {
    await respond({
      text: 'Sorry, I encountered an error. Please try again.',
      response_type: 'ephemeral',
    });
  }
});

app.message(/sobat|what's important|briefing/i, async ({ message, say }) => {
  if (!('user' in message) || !message.user) return;

  try {
    const result = await callOrchestrator(
      message.user,
      'text' in message ? (message.text ?? "what's important today") : "what's important today",
    );
    await say({
      text: formatBriefingResponse(result.data ?? result),
      thread_ts: 'ts' in message ? message.ts : undefined,
    });
  } catch {
    await say({ text: 'Sorry, I could not process that request.' });
  }
});

app.event('app_mention', async ({ event, say }) => {
  const text = event.text.replace(/<@[A-Z0-9]+>/g, '').trim() || "what's important today";

  try {
    const result = await callOrchestrator(event.user!, text);
    await say({
      text: formatBriefingResponse(result.data ?? result),
      thread_ts: event.thread_ts ?? event.ts,
    });
  } catch {
    await say({ text: 'Sorry, I could not process that request.', thread_ts: event.ts });
  }
});

// Approval button interactions
app.action(/^approve_/, async ({ ack, body, client }) => {
  await ack();
  const approvalId = (body as { actions: Array<{ value: string }> }).actions[0]?.value;
  if (!approvalId) return;

  await fetch(`${BACKEND_URL}/api/approvals/${approvalId}/approve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ resolvedBy: body.user.id }),
  });

  if ('channel' in body && body.channel?.id && 'message' in body && body.message?.ts) {
    await client.chat.update({
      channel: body.channel.id,
      ts: body.message.ts,
      text: '✅ Action approved and queued for execution.',
    });
  }
});

app.action(/^reject_/, async ({ ack, body, client }) => {
  await ack();
  const approvalId = (body as { actions: Array<{ value: string }> }).actions[0]?.value;
  if (!approvalId) return;

  await fetch(`${BACKEND_URL}/api/approvals/${approvalId}/reject`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ resolvedBy: body.user.id }),
  });

  if ('channel' in body && body.channel?.id && 'message' in body && body.message?.ts) {
    await client.chat.update({
      channel: body.channel.id,
      ts: body.message.ts,
      text: '❌ Action rejected.',
    });
  }
});

(async () => {
  if (!process.env.SLACK_BOT_TOKEN) {
    console.warn('SLACK_BOT_TOKEN not set — Slack bot will not start');
    console.warn('Configure credentials in .env and run: npm run dev -w slack');
    process.exit(0);
  }

  await app.start();
  console.log('⚡️ SobatHQ Slack bot is running with App Home dashboard!');
})();
