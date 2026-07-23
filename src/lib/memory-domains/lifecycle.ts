import 'server-only';

import { createJournalEntry } from '@/lib/journal';
import { archiveOldDomainMemory } from '@/lib/memory-domains/repository';

export async function runMemoryAgeingLifecycle(
  currentRetentionDays = 120,
): Promise<{ archived: number; cutoff: string }> {
  const normalizedDays = Math.max(30, Math.min(currentRetentionDays, 730));
  const cutoff = new Date(Date.now() - normalizedDays * 86_400_000);
  const archived = await archiveOldDomainMemory({ olderThan: cutoff });

  if (archived > 0) {
    await createJournalEntry({
      title: 'Memory lifecycle archived older records',
      detail: `${archived} older memory record${archived === 1 ? '' : 's'} moved to transparent archive storage. They remain available to unified retrieval whenever relevant.`,
      entryType: 'auto',
      source: 'memory-lifecycle/ageing',
    });
  }

  return { archived, cutoff: cutoff.toISOString() };
}
