import 'server-only';

import { upsertDomainMemory } from '@/lib/memory-domains/repository';
import type { RememberDomainMemoryInput } from '@/lib/memory-domains/types';

export async function rememberProjectMemory(
  input: RememberDomainMemoryInput & { projectId: string },
) {
  return upsertDomainMemory('project', {
    ...input,
    source: input.source ?? 'project-memory',
    importance: input.importance ?? 7,
  });
}
