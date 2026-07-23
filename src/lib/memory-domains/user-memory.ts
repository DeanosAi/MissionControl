import 'server-only';

import { upsertDomainMemory } from '@/lib/memory-domains/repository';
import type { RememberDomainMemoryInput } from '@/lib/memory-domains/types';

export async function rememberUserMemory(input: RememberDomainMemoryInput) {
  return upsertDomainMemory('user', {
    ...input,
    projectId: null,
    source: input.source ?? 'user-memory',
    importance: input.importance ?? 7,
  });
}
