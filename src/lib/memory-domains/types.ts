import { z } from 'zod';

export const memoryDomainSchema = z.enum([
  'user',
  'project',
  'decision',
  'research',
  'operational',
]);

export const memoryLifecycleSchema = z.enum(['current', 'archived']);

export type MemoryDomain = z.infer<typeof memoryDomainSchema>;
export type MemoryLifecycle = z.infer<typeof memoryLifecycleSchema>;

export interface DomainMemoryRecord {
  id: string;
  domain: MemoryDomain;
  key: string;
  title: string;
  content: string;
  summary: string | null;
  projectId: string | null;
  orchestrationRequestId: string | null;
  source: string;
  importance: number;
  lifecycleState: MemoryLifecycle;
  metadata: Record<string, unknown>;
  occurredAt: string;
  lastAccessedAt: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RememberDomainMemoryInput {
  key: string;
  title: string;
  content: string;
  summary?: string | null;
  projectId?: string | null;
  orchestrationRequestId?: string | null;
  source?: string;
  importance?: number;
  metadata?: Record<string, unknown>;
  occurredAt?: Date;
}

export interface UnifiedMemoryQuery {
  query: string;
  projectId?: string | null;
  orchestrationRequestId?: string | null;
  domains?: MemoryDomain[];
  limit?: number;
}

export interface UnifiedMemoryResult {
  records: DomainMemoryRecord[];
  currentCount: number;
  archivedCount: number;
  domainsSearched: MemoryDomain[];
  explanation: string;
}
