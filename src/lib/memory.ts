import 'server-only';

import {
  deleteDomainMemory,
  getDomainMemoryByKey,
  listDomainMemory,
  setDomainMemoryImportance,
} from '@/lib/memory-domains/repository';
import { getUnifiedMemoryContext } from '@/lib/memory-domains/retrieval';
import { rememberUserMemory } from '@/lib/memory-domains/user-memory';

export type MemoryCategory = 'context' | 'preference' | 'fact' | 'instruction';

export interface MemoryNoteRecord {
  id: string;
  key: string;
  content: string;
  category: MemoryCategory;
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateMemoryInput {
  key: string;
  content: string;
  category?: MemoryCategory;
  pinned?: boolean;
}

function categoryFromMetadata(metadata: Record<string, unknown>): MemoryCategory {
  const value = metadata.category ?? metadata.legacyCategory;
  return value === 'preference' || value === 'fact' || value === 'instruction'
    ? value
    : 'context';
}

function mapUserMemory(record: Awaited<ReturnType<typeof listDomainMemory>>[number]): MemoryNoteRecord {
  return {
    id: record.id,
    key: record.key,
    content: record.content,
    category: categoryFromMetadata(record.metadata),
    pinned: record.importance >= 9 || record.metadata.pinned === true,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

/**
 * Existing Memory-page facade.
 * Sprint 1.5 keeps the UI contract intact while persisting new notes in User Memory.
 */
export async function listMemoryNotes(): Promise<MemoryNoteRecord[]> {
  const records = await listDomainMemory({
    domains: ['user'],
    includeArchived: false,
    limit: 250,
  });
  return records
    .map(mapUserMemory)
    .sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt.localeCompare(a.updatedAt));
}

export async function getMemoryByKey(key: string): Promise<MemoryNoteRecord | null> {
  const record = await getDomainMemoryByKey('user', key);
  return record ? mapUserMemory(record) : null;
}

export async function upsertMemoryNote(input: CreateMemoryInput): Promise<MemoryNoteRecord> {
  const record = await rememberUserMemory({
    key: input.key,
    title: input.key,
    content: input.content,
    summary: input.content,
    source: 'curated-memory',
    importance: input.pinned ? 10 : input.category === 'instruction' ? 8 : 7,
    metadata: {
      category: input.category ?? 'context',
      pinned: input.pinned ?? false,
    },
  });
  return mapUserMemory(record);
}

export async function deleteMemoryNote(id: string): Promise<void> {
  await deleteDomainMemory(id);
}

export async function toggleMemoryPin(id: string): Promise<void> {
  const notes = await listMemoryNotes();
  const note = notes.find((item) => item.id === id);
  if (!note) return;
  await setDomainMemoryImportance(id, note.pinned ? 7 : 10);
}

/** Build unified AI-readable context across all specialised memory domains. */
export async function getMemoryContext(query = 'current priorities preferences approvals recurring workflows decisions'): Promise<string> {
  return getUnifiedMemoryContext({
    query,
    limit: 20,
  });
}
