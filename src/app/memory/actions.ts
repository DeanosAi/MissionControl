'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireAdminSession } from '@/lib/auth/session';
import { createJournalEntry, deleteJournalEntry, updateJournalEntry, type JournalType } from '@/lib/journal';
import { upsertMemoryNote, deleteMemoryNote, toggleMemoryPin } from '@/lib/memory';

// -- Journal actions --

const journalSchema = z.object({
  title: z.string().min(1, 'Enter a title.'),
  detail: z.string().min(1, 'Enter detail text.'),
  entryType: z.enum(['milestone', 'ops', 'decision', 'auto', 'note']).default('note'),
});

export interface JournalFormState {
  error?: string;
  success?: string;
}

export async function createJournalAction(_prev: JournalFormState, formData: FormData): Promise<JournalFormState> {
  await requireAdminSession();
  const parsed = journalSchema.safeParse({
    title: formData.get('title'),
    detail: formData.get('detail'),
    entryType: formData.get('entryType'),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid input.' };

  await createJournalEntry({
    title: parsed.data.title,
    detail: parsed.data.detail,
    entryType: parsed.data.entryType as JournalType,
    source: 'manual',
  });

  revalidatePath('/memory');
  return { success: 'Journal entry added.' };
}

export async function updateJournalAction(_prev: JournalFormState, formData: FormData): Promise<JournalFormState> {
  await requireAdminSession();
  const id = String(formData.get('id') ?? '');
  const parsed = journalSchema.safeParse({
    title: formData.get('title'),
    detail: formData.get('detail'),
    entryType: formData.get('entryType'),
  });
  if (!id || !parsed.success) return { error: parsed.success ? 'Missing ID.' : (parsed.error.issues[0]?.message ?? 'Invalid input.') };

  await updateJournalEntry(id, {
    title: parsed.data.title,
    detail: parsed.data.detail,
    entryType: parsed.data.entryType as JournalType,
  });

  revalidatePath('/memory');
  return { success: 'Journal entry updated.' };
}

export async function deleteJournalAction(id: string): Promise<void> {
  await requireAdminSession();
  if (!id) return;
  await deleteJournalEntry(id);
  revalidatePath('/memory');
}

// -- Memory actions --

const memorySchema = z.object({
  key: z.string().min(1, 'Enter a key.'),
  content: z.string().min(1, 'Enter content.'),
  category: z.enum(['context', 'preference', 'fact', 'instruction']).default('context'),
});

export interface MemoryFormState {
  error?: string;
  success?: string;
}

export async function upsertMemoryAction(_prev: MemoryFormState, formData: FormData): Promise<MemoryFormState> {
  await requireAdminSession();
  const parsed = memorySchema.safeParse({
    key: formData.get('key'),
    content: formData.get('content'),
    category: formData.get('category'),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid input.' };

  await upsertMemoryNote({
    key: parsed.data.key,
    content: parsed.data.content,
    category: parsed.data.category as 'context' | 'preference' | 'fact' | 'instruction',
  });

  revalidatePath('/memory');
  return { success: 'Memory note saved.' };
}

export async function deleteMemoryAction(id: string): Promise<void> {
  await requireAdminSession();
  if (!id) return;
  await deleteMemoryNote(id);
  revalidatePath('/memory');
}

export async function toggleMemoryPinAction(id: string): Promise<void> {
  await requireAdminSession();
  if (!id) return;
  await toggleMemoryPin(id);
  revalidatePath('/memory');
}
