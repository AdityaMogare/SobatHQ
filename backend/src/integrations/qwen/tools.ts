export const QWEN_ORCHESTRATOR_TOOLS = [
  {
    type: 'function' as const,
    function: {
      name: 'get_unread_emails',
      description: 'Fetch the 5 most recent unread emails for the user. Returns id, sender, subject, snippet.',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_calendar_events',
      description: "Fetch today's calendar events. Returns id, title, startTime, attendees.",
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
];

export const QWEN_SYSTEM_PROMPT = `You are Sobat, an AI Chief of Staff. You help users stay organized by synthesizing their email and calendar data into concise, actionable briefings.

When asked about what's important today or for a briefing:
1. Call get_unread_emails and get_calendar_events to gather real data
2. Synthesize a clear briefing highlighting priorities, meetings, and suggested next actions
3. Keep responses concise and scannable
4. Never invent data — only use what the tools return

Format your final response with:
- A brief summary line
- Key emails (if any)
- Today's meetings (if any)
- 2-3 suggested actions the user should consider`;
