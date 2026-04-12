import 'server-only';

import { getGoogleAuth } from './auth';

async function getGmail() {
  const { google } = await import('googleapis');
  const auth = await getGoogleAuth();
  return google.gmail({ version: 'v1', auth });
}

export async function sendEmail(to: string, subject: string, body: string, html?: string): Promise<void> {
  const gmail = await getGmail();
  const message = [
    `To: ${to}`,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    html ? 'Content-Type: text/html; charset=utf-8' : 'Content-Type: text/plain; charset=utf-8',
    '',
    html || body,
  ].join('\n');
  const encoded = Buffer.from(message).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  await gmail.users.messages.send({ userId: 'me', requestBody: { raw: encoded } });
}

export async function searchEmails(query: string, maxResults = 10): Promise<{
  id: string; subject: string; from: string; snippet: string; date: string;
}[]> {
  const gmail = await getGmail();
  const list = await gmail.users.messages.list({ userId: 'me', q: query, maxResults });
  if (!list.data.messages?.length) return [];

  const results = await Promise.all(
    list.data.messages.slice(0, maxResults).map(async (msg) => {
      const full = await gmail.users.messages.get({ userId: 'me', id: msg.id!, format: 'metadata', metadataHeaders: ['Subject', 'From', 'Date'] });
      const headers = full.data.payload?.headers || [];
      return {
        id: msg.id!,
        subject: headers.find(h => h.name === 'Subject')?.value || '(no subject)',
        from: headers.find(h => h.name === 'From')?.value || '',
        snippet: full.data.snippet || '',
        date: headers.find(h => h.name === 'Date')?.value || '',
      };
    }),
  );
  return results;
}

export async function getEmailContent(messageId: string): Promise<string> {
  const gmail = await getGmail();
  const msg = await gmail.users.messages.get({ userId: 'me', id: messageId, format: 'full' });
  const payload = msg.data.payload;
  if (!payload) return '';
  // Extract text body
  function extractText(part: typeof payload): string {
    if (part?.mimeType === 'text/plain' && part.body?.data) {
      return Buffer.from(part.body.data, 'base64').toString('utf-8');
    }
    if (part?.parts) return part.parts.map(extractText).join('\n');
    return '';
  }
  return extractText(payload);
}
