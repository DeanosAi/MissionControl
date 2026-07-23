import 'server-only';

import {
  listDomainMemory,
  markMemoryAccessed,
} from '@/lib/memory-domains/repository';
import type {
  DomainMemoryRecord,
  MemoryDomain,
  UnifiedMemoryQuery,
  UnifiedMemoryResult,
} from '@/lib/memory-domains/types';

const ALL_DOMAINS: MemoryDomain[] = ['user', 'project', 'decision', 'research', 'operational'];

function tokenize(value: string): string[] {
  return [...new Set(
    value
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((token) => token.length > 2)
      .slice(0, 30),
  )];
}

function relevanceScore(
  record: DomainMemoryRecord,
  terms: string[],
  projectId: string | null,
  requestId: string | null,
): number {
  const searchable = `${record.key} ${record.title} ${record.summary ?? ''} ${record.content}`.toLowerCase();
  const termMatches = terms.reduce((score, term) => score + (searchable.includes(term) ? 1 : 0), 0);
  const exactProject = projectId && record.projectId === projectId ? 6 : 0;
  const exactRequest = requestId && record.orchestrationRequestId === requestId ? 8 : 0;
  const userMemory = record.domain === 'user' ? 2 : 0;
  const current = record.lifecycleState === 'current' ? 2 : 0;
  const recencyDays = Math.max(0, (Date.now() - Date.parse(record.updatedAt)) / 86_400_000);
  const recency = Math.max(0, 3 - recencyDays / 30);
  return termMatches * 3 + exactProject + exactRequest + userMemory + current + record.importance / 2 + recency;
}

export async function retrieveUnifiedMemory(
  input: UnifiedMemoryQuery,
): Promise<UnifiedMemoryResult> {
  const domains = input.domains ?? ALL_DOMAINS;
  const projectId = input.projectId ?? null;
  const requestId = input.orchestrationRequestId ?? null;
  const limit = Math.max(1, Math.min(input.limit ?? 24, 80));
  const terms = tokenize(input.query);
  const candidates = await listDomainMemory({
    domains,
    projectId,
    includeArchived: true,
    limit: 400,
  });

  const ranked = candidates
    .map((record) => ({
      record,
      score: relevanceScore(record, terms, projectId, requestId),
    }))
    .filter(({ record, score }) => (
      score >= 4
      || record.importance >= 9
      || record.projectId === projectId
      || record.orchestrationRequestId === requestId
    ))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ record }) => record);

  await markMemoryAccessed(ranked.map((record) => record.id));

  const currentCount = ranked.filter((record) => record.lifecycleState === 'current').length;
  const archivedCount = ranked.length - currentCount;
  return {
    records: ranked,
    currentCount,
    archivedCount,
    domainsSearched: domains,
    explanation: archivedCount > 0
      ? `Retrieved ${currentCount} current and ${archivedCount} archived memories automatically.`
      : `Retrieved ${currentCount} current memories. Archived memory remained available but was not needed.`,
  };
}

export function formatUnifiedMemoryContext(result: UnifiedMemoryResult): string {
  if (result.records.length === 0) {
    return `Unified memory searched ${result.domainsSearched.join(', ')}. No relevant memory was found.`;
  }

  const lines = [
    `Unified memory (${result.explanation})`,
  ];
  for (const domain of result.domainsSearched) {
    const records = result.records.filter((record) => record.domain === domain);
    if (records.length === 0) continue;
    lines.push('', `${domain.toUpperCase()} MEMORY:`);
    for (const record of records) {
      const archive = record.lifecycleState === 'archived' ? ' [archived, retrieved automatically]' : '';
      lines.push(`- ${record.title}${archive}: ${record.summary ?? record.content}`);
    }
  }
  return lines.join('\n');
}

export async function getUnifiedMemoryContext(input: UnifiedMemoryQuery): Promise<string> {
  return formatUnifiedMemoryContext(await retrieveUnifiedMemory(input));
}
