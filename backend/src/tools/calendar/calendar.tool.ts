import { google } from 'googleapis';
import { BaseTool } from '../base-tool.js';
import { createChildLogger } from '../../utils/logger.js';
import type { GoogleOAuthService } from '../../auth/google.oauth.js';
import type { TokenStore } from '../../auth/token-store.js';
import { resolveGoogleAccessToken } from '../google-token.helper.js';
import type { ToolContext, ToolDefinition, ToolResult } from '../../types/index.js';

const log = createChildLogger('tools:calendar');

export interface CalendarEventSummary {
  id: string;
  title: string;
  startTime: string;
  attendees: string[];
}

export class CalendarTool extends BaseTool {
  readonly definition: ToolDefinition = {
    name: 'calendar',
    displayName: 'Google Calendar',
    description: 'View and manage calendar events and meetings',
    requiredScopes: [
      'https://www.googleapis.com/auth/calendar.readonly',
      'https://www.googleapis.com/auth/calendar.events',
    ],
    actions: ['list_today', 'get_calendar_events', 'get_event', 'create_event', 'find_conflicts', 'reschedule'],
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
      case 'list_today':
      case 'get_calendar_events':
        return this.getCalendarEvents(context);
      case 'create_event':
        return this.createEvent(context, params);
      case 'find_conflicts':
        return this.findConflicts(context, params);
      default:
        return { success: false, error: `Unknown Calendar action: ${action}` };
    }
  }

  async getCalendarEvents(context: ToolContext): Promise<ToolResult> {
    try {
      const accessToken = await this.resolveToken(context);
      if (!accessToken) return this.notConfigured();

      const auth = new google.auth.OAuth2();
      auth.setCredentials({ access_token: accessToken });
      const calendar = google.calendar({ version: 'v3', auth });

      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date();
      endOfDay.setHours(23, 59, 59, 999);

      const { data } = await calendar.events.list({
        calendarId: 'primary',
        timeMin: startOfDay.toISOString(),
        timeMax: endOfDay.toISOString(),
        singleEvents: true,
        orderBy: 'startTime',
        maxResults: 20,
      });

      const events: CalendarEventSummary[] = (data.items ?? []).map((evt) => ({
        id: evt.id ?? '',
        title: evt.summary ?? '(no title)',
        startTime: evt.start?.dateTime ?? evt.start?.date ?? '',
        attendees: (evt.attendees ?? [])
          .map((a) => a.email ?? a.displayName ?? '')
          .filter(Boolean),
      }));

      log.info({ userId: context.userId, count: events.length }, 'Fetched today calendar events');
      return { success: true, data: events };
    } catch (err) {
      log.error({ err, userId: context.userId }, 'getCalendarEvents failed');
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to fetch calendar events',
      };
    }
  }

  private async resolveToken(context: ToolContext): Promise<string | null> {
    if (context.accessToken) return context.accessToken;
    if (!this.tokenStore || !this.googleOAuth) return null;
    return resolveGoogleAccessToken(context.userId, this.tokenStore, this.googleOAuth);
  }

  private async createEvent(
    _context: ToolContext,
    params: Record<string, unknown>,
  ): Promise<ToolResult> {
    return {
      success: true,
      data: {
        title: params.title,
        start: params.start,
        end: params.end,
        requiresApproval: true,
      },
    };
  }

  private async findConflicts(
    _context: ToolContext,
    params: Record<string, unknown>,
  ): Promise<ToolResult> {
    return { success: true, data: { conflicts: [], requestedSlot: params } };
  }
}
