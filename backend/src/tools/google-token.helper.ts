import type { GoogleOAuthService } from '../auth/google.oauth.js';
import type { TokenStore } from '../auth/token-store.js';
import { createChildLogger } from '../utils/logger.js';

const log = createChildLogger('tools:google-token');

export async function resolveGoogleAccessToken(
  userId: string,
  tokenStore: TokenStore,
  googleOAuth: GoogleOAuthService,
): Promise<string | null> {
  try {
    const tokens = await tokenStore.getTokens(userId, 'google');
    if (!tokens) {
      log.warn({ userId }, 'No Google tokens found for user');
      return null;
    }

    return await tokenStore.getValidAccessToken(userId, 'google', (t) =>
      googleOAuth.refreshTokens(t),
    );
  } catch (err) {
    log.error({ err, userId }, 'Failed to resolve Google access token');
    return null;
  }
}
