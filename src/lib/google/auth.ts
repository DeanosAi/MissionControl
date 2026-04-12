import 'server-only';

import { getDb } from '@/lib/db';

/**
 * Google OAuth helper.
 * Uses the `googleapis` npm package.
 * Tokens are stored in the google_auth table (single row, upserted).
 */

let googleModule: typeof import('googleapis') | null = null;

async function getGoogleapis() {
  if (!googleModule) {
    try {
      googleModule = await import('googleapis');
    } catch {
      throw new Error('googleapis package not installed. Run: npm install googleapis');
    }
  }
  return googleModule;
}

function getClientConfig() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error('Google OAuth not configured. Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI.');
  }
  return { clientId, clientSecret, redirectUri };
}

export async function getOAuth2Client() {
  const { google } = await getGoogleapis();
  const { clientId, clientSecret, redirectUri } = getClientConfig();
  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

export function getAuthUrl(oauth2Client: any) {
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: [
      'https://www.googleapis.com/auth/drive.file',
      'https://www.googleapis.com/auth/gmail.modify',
      'https://www.googleapis.com/auth/documents',
      'https://www.googleapis.com/auth/spreadsheets',
      'https://www.googleapis.com/auth/calendar.readonly',
    ],
    prompt: 'consent',
  });
}

export async function saveTokens(tokens: {
  refresh_token?: string | null;
  access_token?: string | null;
  expiry_date?: number | null;
}): Promise<void> {
  const sql = getDb();
  const refreshToken = tokens.refresh_token ?? null;
  const accessToken = tokens.access_token ?? null;
  const expiresAt = tokens.expiry_date ? new Date(tokens.expiry_date) : null;

  // Upsert single row
  const [existing] = await sql<{ id: number }[]>`SELECT id FROM mission_control.google_auth LIMIT 1`;
  if (existing) {
    await sql`
      UPDATE mission_control.google_auth
      SET refresh_token = COALESCE(${refreshToken}, refresh_token),
          access_token = ${accessToken},
          expires_at = ${expiresAt},
          updated_at = NOW()
      WHERE id = ${existing.id}
    `;
  } else {
    await sql`
      INSERT INTO mission_control.google_auth (refresh_token, access_token, expires_at)
      VALUES (${refreshToken}, ${accessToken}, ${expiresAt})
    `;
  }
}

export async function getStoredTokens(): Promise<{
  refreshToken: string; accessToken: string | null; expiresAt: Date | null;
} | null> {
  const sql = getDb();
  const [row] = await sql<{
    refresh_token: string; access_token: string | null; expires_at: Date | null;
  }[]>`SELECT refresh_token, access_token, expires_at FROM mission_control.google_auth LIMIT 1`;
  if (!row) return null;
  return { refreshToken: row.refresh_token, accessToken: row.access_token, expiresAt: row.expires_at };
}

/** Get an authenticated OAuth2 client with valid tokens */
export async function getGoogleAuth() {
  const oauth2Client = await getOAuth2Client();
  const tokens = await getStoredTokens();
  if (!tokens) {
    throw new Error('Google not authorized. Visit /api/google/auth to connect your Google account.');
  }
  oauth2Client.setCredentials({
    refresh_token: tokens.refreshToken,
    access_token: tokens.accessToken ?? undefined,
  });
  // Auto-refresh will be handled by the googleapis library
  oauth2Client.on('tokens', async (newTokens) => {
    try { await saveTokens(newTokens); } catch { /* non-critical */ }
  });
  return oauth2Client;
}

/** Check if Google is authorized */
export async function isGoogleAuthorized(): Promise<boolean> {
  const tokens = await getStoredTokens();
  return !!tokens?.refreshToken;
}
