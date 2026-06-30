import { google } from 'googleapis';
import type { GoogleOAuthService } from '../../auth/google.oauth.js';
import { createChildLogger } from '../../utils/logger.js';

const log = createChildLogger('integrations:drive');

export class DriveService {
  constructor(private googleOAuth: GoogleOAuthService) {}

  async listRecent(userId: string, pageSize = 10) {
    const auth = await this.googleOAuth.getAuthenticatedClient(userId);
    const drive = google.drive({ version: 'v3', auth });

    const { data } = await drive.files.list({
      pageSize,
      fields: 'files(id,name,mimeType,modifiedTime,webViewLink)',
      orderBy: 'modifiedTime desc',
    });

    const files = (data.files ?? []).map((f) => ({
      id: f.id,
      name: f.name,
      mimeType: f.mimeType,
      modifiedAt: f.modifiedTime,
      webViewLink: f.webViewLink,
    }));

    log.info({ userId, count: files.length }, 'Listed recent Drive files');
    return { files };
  }

  async search(userId: string, query: string) {
    const auth = await this.googleOAuth.getAuthenticatedClient(userId);
    const drive = google.drive({ version: 'v3', auth });

    const { data } = await drive.files.list({
      q: `name contains '${query.replace(/'/g, "\\'")}'`,
      pageSize: 20,
      fields: 'files(id,name,mimeType,modifiedTime)',
    });

    return { query, files: data.files ?? [] };
  }
}
