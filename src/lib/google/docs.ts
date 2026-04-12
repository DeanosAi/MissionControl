import 'server-only';

import { getGoogleAuth } from './auth';

async function getDocs() {
  const { google } = await import('googleapis');
  const auth = await getGoogleAuth();
  return google.docs({ version: 'v1', auth });
}

export async function createDoc(title: string, content: string): Promise<{ docId: string; url: string }> {
  const docs = await getDocs();
  const doc = await docs.documents.create({ requestBody: { title } });
  const docId = doc.data.documentId!;

  if (content) {
    await docs.documents.batchUpdate({
      documentId: docId,
      requestBody: {
        requests: [{ insertText: { location: { index: 1 }, text: content } }],
      },
    });
  }

  return { docId, url: `https://docs.google.com/document/d/${docId}/edit` };
}

export async function getDocContent(docId: string): Promise<string> {
  const docs = await getDocs();
  const doc = await docs.documents.get({ documentId: docId });
  const body = doc.data.body?.content || [];
  let text = '';
  for (const element of body) {
    if (element.paragraph?.elements) {
      for (const el of element.paragraph.elements) {
        if (el.textRun?.content) text += el.textRun.content;
      }
    }
  }
  return text;
}

export async function appendToDoc(docId: string, content: string): Promise<void> {
  const docs = await getDocs();
  const doc = await docs.documents.get({ documentId: docId });
  const endIndex = doc.data.body?.content?.at(-1)?.endIndex ?? 1;
  await docs.documents.batchUpdate({
    documentId: docId,
    requestBody: {
      requests: [{ insertText: { location: { index: Math.max(1, endIndex - 1) }, text: '\n' + content } }],
    },
  });
}
