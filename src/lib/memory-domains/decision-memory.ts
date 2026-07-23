import 'server-only';

import { upsertDomainMemory } from '@/lib/memory-domains/repository';
import type { RememberDomainMemoryInput } from '@/lib/memory-domains/types';

export async function rememberDecisionMemory(
  input: RememberDomainMemoryInput & { projectId: string },
) {
  return upsertDomainMemory('decision', {
    ...input,
    source: input.source ?? 'decision-engine',
    importance: input.importance ?? 8,
  });
}
