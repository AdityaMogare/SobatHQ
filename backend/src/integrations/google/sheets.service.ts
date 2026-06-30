import { google } from 'googleapis';
import type { GoogleOAuthService } from '../../auth/google.oauth.js';
import { createChildLogger } from '../../utils/logger.js';

const log = createChildLogger('integrations:sheets');

export class SheetsService {
  constructor(private googleOAuth: GoogleOAuthService) {}

  async readRange(userId: string, spreadsheetId: string, range: string) {
    const auth = await this.googleOAuth.getAuthenticatedClient(userId);
    const sheets = google.sheets({ version: 'v4', auth });

    const { data } = await sheets.spreadsheets.values.get({ spreadsheetId, range });
    return { range, values: data.values ?? [] };
  }

  async getSpreadsheet(userId: string, spreadsheetId: string) {
    const auth = await this.googleOAuth.getAuthenticatedClient(userId);
    const sheets = google.sheets({ version: 'v4', auth });

    const { data } = await sheets.spreadsheets.get({
      spreadsheetId,
      fields: 'properties.title,sheets.properties',
    });

    log.info({ userId, spreadsheetId }, 'Fetched spreadsheet metadata');
    return {
      spreadsheetId,
      title: data.properties?.title,
      sheets: data.sheets?.map((s) => s.properties?.title).filter(Boolean),
    };
  }

  async writeRange(
    userId: string,
    spreadsheetId: string,
    range: string,
    values: unknown[][],
  ) {
    const auth = await this.googleOAuth.getAuthenticatedClient(userId);
    const sheets = google.sheets({ version: 'v4', auth });

    const { data } = await sheets.spreadsheets.values.update({
      spreadsheetId,
      range,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values },
    });

    return {
      updatedRange: data.updatedRange,
      updatedCells: data.updatedCells,
      requiresApproval: true,
    };
  }
}
