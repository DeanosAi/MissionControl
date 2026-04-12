import { requireAdminSession } from '@/lib/auth/session';
import { uploadFile, ensureFolderStructure } from '@/lib/google/drive';
import { createJournalEntry } from '@/lib/journal';

export async function POST(request: Request) {
  try { await requireAdminSession(); } catch { return Response.json({ error: 'Unauthorized' }, { status: 401 }); }

  const { filename, code, language } = await request.json();
  if (!filename || !code) return Response.json({ error: 'filename and code required' }, { status: 400 });

  try {
    const folders = await ensureFolderStructure();
    const mimeType = language === 'html' ? 'text/html' : 'text/plain';
    const result = await uploadFile(filename, code, mimeType, folders.tasks);

    try {
      await createJournalEntry({
        title: `Uploaded ${filename} to Google Drive`,
        detail: `URL: ${result.url}`,
        entryType: 'ops',
        source: 'google-drive',
      });
    } catch { /* non-critical */ }

    return Response.json({ url: result.url, fileId: result.fileId });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Upload failed';
    return Response.json({ error: msg }, { status: 500 });
  }
}
