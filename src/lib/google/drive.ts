import 'server-only';

import { getDb } from '@/lib/db';
import { getGoogleAuth } from './auth';

async function getDrive() {
  const { google } = await import('googleapis');
  const auth = await getGoogleAuth();
  return google.drive({ version: 'v3', auth });
}

export async function uploadFile(
  filename: string,
  content: string | Buffer,
  mimeType: string,
  folderId?: string,
): Promise<{ fileId: string; url: string }> {
  const drive = await getDrive();
  const { Readable } = await import('stream');

  const fileMetadata: Record<string, unknown> = { name: filename };
  if (folderId) fileMetadata.parents = [folderId];

  const body = typeof content === 'string' ? Readable.from(Buffer.from(content, 'utf-8')) : Readable.from(content);

  const file = await drive.files.create({
    requestBody: fileMetadata,
    media: { mimeType, body },
    fields: 'id, webViewLink',
  });

  // Make shareable
  try {
    await drive.permissions.create({
      fileId: file.data.id!,
      requestBody: { role: 'reader', type: 'anyone' },
    });
  } catch { /* non-critical */ }

  return { fileId: file.data.id!, url: file.data.webViewLink || `https://drive.google.com/file/d/${file.data.id}/view` };
}

export async function createFolder(name: string, parentId?: string): Promise<string> {
  const drive = await getDrive();
  const meta: Record<string, unknown> = { name, mimeType: 'application/vnd.google-apps.folder' };
  if (parentId) meta.parents = [parentId];
  const folder = await drive.files.create({ requestBody: meta, fields: 'id' });
  return folder.data.id!;
}

export async function listFiles(folderId?: string): Promise<{ id: string; name: string; url: string }[]> {
  const drive = await getDrive();
  const q = folderId ? `'${folderId}' in parents and trashed = false` : 'trashed = false';
  const res = await drive.files.list({ q, fields: 'files(id, name, webViewLink)', pageSize: 50 });
  return (res.data.files || []).map(f => ({
    id: f.id!, name: f.name!, url: f.webViewLink || `https://drive.google.com/file/d/${f.id}/view`,
  }));
}

/** Ensure /Mission Control/Tasks, /Ideas, /Automated folder structure */
export async function ensureFolderStructure(): Promise<{
  missionControl: string; tasks: string; ideas: string; automated: string;
}> {
  const sql = getDb();

  // Check if we already have folder IDs stored
  const stored = await sql<{ name: string; folder_id: string }[]>`
    SELECT name, folder_id FROM mission_control.google_folders
  `;
  const map = Object.fromEntries(stored.map(r => [r.name, r.folder_id]));
  if (map.mission_control && map.tasks && map.ideas && map.automated) {
    return { missionControl: map.mission_control, tasks: map.tasks, ideas: map.ideas, automated: map.automated };
  }

  // Create folders
  const mc = await createFolder('Mission Control');
  const tasks = await createFolder('Tasks', mc);
  const ideas = await createFolder('Ideas', mc);
  const automated = await createFolder('Automated', mc);

  // Store for reuse
  for (const [name, folderId] of [['mission_control', mc], ['tasks', tasks], ['ideas', ideas], ['automated', automated]]) {
    await sql`
      INSERT INTO mission_control.google_folders (name, folder_id) VALUES (${name}, ${folderId})
      ON CONFLICT (name) DO UPDATE SET folder_id = EXCLUDED.folder_id, updated_at = NOW()
    `;
  }

  return { missionControl: mc, tasks, ideas, automated };
}

export async function getFolderIds(): Promise<Record<string, string>> {
  const sql = getDb();
  const rows = await sql<{ name: string; folder_id: string }[]>`
    SELECT name, folder_id FROM mission_control.google_folders
  `;
  return Object.fromEntries(rows.map(r => [r.name, r.folder_id]));
}
