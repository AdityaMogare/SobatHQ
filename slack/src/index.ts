import 'dotenv/config';
import { App } from '@slack/bolt';

const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  socketMode: !!process.env.SLACK_APP_TOKEN,
  appToken: process.env.SLACK_APP_TOKEN,
  port: Number(process.env.SLACK_PORT ?? 3002),
});

const BACKEND_URL = process.env.BACKEND_URL ?? 'http://localhost:3001';

async function askSobat(userId: string, message: string, context?: Record<string, unknown>) {
  const res = await fetch(`${BACKEND_URL}/api/orchestrate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, message, context: { source: 'slack', ...context } }),
  });
  return res.json();
}

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

// Slash command: /sobat
app.command('/sobat', async ({ command, ack, respond }) => {
  await ack();

  const query = command.text.trim() || "what's important today";

  try {
    const result = await askSobat(command.user_id, query, { channelId: command.channel_id });
    const text = formatBriefingResponse(result.data ?? result);
    await respond({ text, response_type: 'ephemeral' });
  } catch (err) {
    await respond({
      text: 'Sorry, I encountered an error. Please try again.',
      response_type: 'ephemeral',
    });
  }
});

// Direct messages and @mentions
app.message(/sobat|what's important|briefing/i, async ({ message, say }) => {
  if (!('user' in message) || !message.user) return;

  try {
    const result = await askSobat(
      message.user,
      'text' in message ? (message.text ?? "what's important today") : "what's important today",
      { channelId: message.channel, threadTs: 'ts' in message ? message.ts : undefined },
    );
    const text = formatBriefingResponse(result.data ?? result);
    await say({ text, thread_ts: 'ts' in message ? message.ts : undefined });
  } catch {
    await say({ text: 'Sorry, I could not process that request.' });
  }
});

app.event('app_mention', async ({ event, say }) => {
  const text = event.text.replace(/<@[A-Z0-9]+>/g, '').trim() || "what's important today";

  try {
    const result = await askSobat(event.user, text, {
      channelId: event.channel,
      threadTs: event.ts,
    });
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
  console.log('⚡️ SobatHQ Slack bot is running!');
})();
