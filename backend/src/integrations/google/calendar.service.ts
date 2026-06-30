import { google } from 'googleapis';
import type { GoogleOAuthService } from '../../auth/google.oauth.js';
import { createChildLogger } from '../../utils/logger.js';

const log = createChildLogger('integrations:calendar');

export class CalendarService {
  constructor(private googleOAuth: GoogleOAuthService) {}

  async listToday(userId: string) {
    const auth = await this.googleOAuth.getAuthenticatedClient(userId);
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
    });

    const events = (data.items ?? []).map((evt) => ({
      id: evt.id,
      title: evt.summary ?? '(no title)',
      start: evt.start?.dateTime ?? evt.start?.date,
      end: evt.end?.dateTime ?? evt.end?.date,
      location: evt.location,
      updated: evt.updated !== evt.created,
    }));

    log.info({ userId, count: events.length }, 'Listed today calendar events');
    return { events };
  }

  async createEvent(
    userId: string,
    params: { title: string; start: string; end: string; description?: string },
  ) {
    const auth = await this.googleOAuth.getAuthenticatedClient(userId);
    const calendar = google.calendar({ version: 'v3', auth });

    const { data } = await calendar.events.insert({
      calendarId: 'primary',
      requestBody: {
        summary: params.title,
        description: params.description,
        start: { dateTime: params.start },
        end: { dateTime: params.end },
      },
    });

    return {
      eventId: data.id,
      htmlLink: data.htmlLink,
      requiresApproval: true,
    };
  }
}
