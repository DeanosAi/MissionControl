import 'server-only';

import { upsertDomainMemory } from '@/lib/memory-domains/repository';
import type { RememberDomainMemoryInput } from '@/lib/memory-domains/types';

export async function rememberResearchMemory(input: RememberDomainMemoryInput) {
  return upsertDomainMemory('research', {
    ...input,
    source: input.source ?? 'research-engine',
    importance: input.importance ?? 6,
  });
}
