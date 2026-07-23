import 'server-only';

import { upsertDomainMemory } from '@/lib/memory-domains/repository';
import type { RememberDomainMemoryInput } from '@/lib/memory-domains/types';

export async function rememberOperationalMemory(input: RememberDomainMemoryInput) {
  return upsertDomainMemory('operational', {
    ...input,
    source: input.source ?? 'operations',
    importance: input.importance ?? 7,
  });
}
