import 'server-only';

import { getGoogleAuth } from './auth';

async function getCalendar() {
  const { google } = await import('googleapis');
  const auth = await getGoogleAuth();
  return google.calendar({ version: 'v3', auth });
}

export async function getTodayEvents(): Promise<{ summary: string; start: string; end: string }[]> {
  const calendar = await getCalendar();
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);

  const res = await calendar.events.list({
    calendarId: 'primary',
    timeMin: startOfDay.toISOString(),
    timeMax: endOfDay.toISOString(),
    singleEvents: true,
    orderBy: 'startTime',
  });

  return (res.data.items || []).map(e => ({
    summary: e.summary || '(no title)',
    start: e.start?.dateTime || e.start?.date || '',
    end: e.end?.dateTime || e.end?.date || '',
  }));
}

export async function getUpcomingEvents(days = 7): Promise<{ summary: string; start: string; end: string; date: string }[]> {
  const calendar = await getCalendar();
  const now = new Date();
  const future = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

  const res = await calendar.events.list({
    calendarId: 'primary',
    timeMin: now.toISOString(),
    timeMax: future.toISOString(),
    singleEvents: true,
    orderBy: 'startTime',
    maxResults: 50,
  });

  return (res.data.items || []).map(e => ({
    summary: e.summary || '(no title)',
    start: e.start?.dateTime || e.start?.date || '',
    end: e.end?.dateTime || e.end?.date || '',
    date: (e.start?.dateTime || e.start?.date || '').split('T')[0],
  }));
}
