import 'server-only';

import { getGoogleAuth } from './auth';

async function getSheets() {
  const { google } = await import('googleapis');
  const auth = await getGoogleAuth();
  return google.sheets({ version: 'v4', auth });
}

export async function createSheet(title: string): Promise<{ spreadsheetId: string; url: string }> {
  const sheets = await getSheets();
  const res = await sheets.spreadsheets.create({ requestBody: { properties: { title } } });
  return {
    spreadsheetId: res.data.spreadsheetId!,
    url: res.data.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${res.data.spreadsheetId}/edit`,
  };
}

export async function readSheet(spreadsheetId: string, range: string): Promise<string[][]> {
  const sheets = await getSheets();
  const res = await sheets.spreadsheets.values.get({ spreadsheetId, range });
  return (res.data.values || []) as string[][];
}

export async function writeSheet(spreadsheetId: string, range: string, values: string[][]): Promise<void> {
  const sheets = await getSheets();
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values },
  });
}
