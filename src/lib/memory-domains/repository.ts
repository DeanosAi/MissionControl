import 'server-only';

import { getDb } from '@/lib/db';
import type {
  DomainMemoryRecord,
  MemoryDomain,
  MemoryLifecycle,
  RememberDomainMemoryInput,
} from '@/lib/memory-domains/types';

type MemoryRow = {
  id: string;
  domain: MemoryDomain;
  key: string;
  title: string;
  content: string;
  summary: string | null;
  project_id: string | null;
  orchestration_request_id: string | null;
  source: string;
  importance: number;
  lifecycle_state: MemoryLifecycle;
  metadata: unknown;
  occurred_at: Date;
  last_accessed_at: Date | null;
  archived_at: Date | null;
  created_at: Date;
  updated_at: Date;
};

function normalizeMetadata(value: unknown): Record<string, unknown> {
  let current = value;
  for (let attempt = 0; attempt < 2 && typeof current === 'string'; attempt += 1) {
    try {
      current = JSON.parse(current);
    } catch {
      return {};
    }
  }
  return current && typeof current === 'object' && !Array.isArray(current)
    ? current as Record<string, unknown>
    : {};
}

function mapRow(row: MemoryRow): DomainMemoryRecord {
  return {
    id: row.id,
    domain: row.domain,
    key: row.key,
    title: row.title,
    content: row.content,
    summary: row.summary,
    projectId: row.project_id,
    orchestrationRequestId: row.orchestration_request_id,
    source: row.source,
    importance: row.importance,
    lifecycleState: row.lifecycle_state,
    metadata: normalizeMetadata(row.metadata),
    occurredAt: row.occurred_at.toISOString(),
    lastAccessedAt: row.last_accessed_at?.toISOString() ?? null,
    archivedAt: row.archived_at?.toISOString() ?? null,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

function toJson(value: unknown): never {
  return JSON.parse(JSON.stringify(value)) as never;
}

const memorySelect = `
  SELECT id, domain, key, title, content, summary, project_id,
         orchestration_request_id, source, importance, lifecycle_state,
         metadata, occurred_at, last_accessed_at, archived_at, created_at, updated_at
  FROM mission_control.memory_records
`;

export async function upsertDomainMemory(
  domain: MemoryDomain,
  input: RememberDomainMemoryInput,
): Promise<DomainMemoryRecord> {
  const sql = getDb();
  const projectId = input.projectId ?? null;
  const importance = Math.max(1, Math.min(10, input.importance ?? 5));
  const [inserted] = await sql<{ id: string }[]>`
    INSERT INTO mission_control.memory_records (
      domain, key, title, content, summary, project_id, orchestration_request_id,
      source, importance, metadata, occurred_at
    )
    VALUES (
      ${domain}, ${input.key}, ${input.title}, ${input.content}, ${input.summary ?? null},
      ${projectId}, ${input.orchestrationRequestId ?? null}, ${input.source ?? 'manual'},
      ${importance}, ${sql.json(toJson(input.metadata ?? {}))}, ${input.occurredAt ?? new Date()}
    )
    ON CONFLICT DO NOTHING
    RETURNING id
  `;

  let id = inserted?.id;
  if (!id) {
    const [updated] = await sql<{ id: string }[]>`
      UPDATE mission_control.memory_records
      SET title = ${input.title},
          content = ${input.content},
          summary = ${input.summary ?? null},
          orchestration_request_id = COALESCE(
            ${input.orchestrationRequestId ?? null},
            orchestration_request_id
          ),
          source = ${input.source ?? 'manual'},
          importance = ${importance},
          lifecycle_state = 'current',
          metadata = ${sql.json(toJson(input.metadata ?? {}))},
          occurred_at = ${input.occurredAt ?? new Date()},
          archived_at = NULL,
          updated_at = NOW()
      WHERE domain = ${domain}
        AND key = ${input.key}
        AND (
          project_id = ${projectId}
          OR (project_id IS NULL AND ${projectId} IS NULL)
        )
      RETURNING id
    `;
    id = updated?.id;
  }

  if (!id) throw new Error(`Unable to save ${domain} memory "${input.key}".`);
  const record = await getDomainMemoryById(id);
  if (!record) throw new Error('Memory was saved but could not be reloaded.');
  return record;
}

export async function getDomainMemoryById(id: string): Promise<DomainMemoryRecord | null> {
  const sql = getDb();
  const rows = await sql.unsafe<MemoryRow[]>(`${memorySelect} WHERE id = $1 LIMIT 1`, [id]);
  return rows[0] ? mapRow(rows[0]) : null;
}

export async function getDomainMemoryByKey(
  domain: MemoryDomain,
  key: string,
  projectId: string | null = null,
): Promise<DomainMemoryRecord | null> {
  const sql = getDb();
  const rows = await sql.unsafe<MemoryRow[]>(
    `${memorySelect}
     WHERE domain = $1
       AND key = $2
       AND (project_id = $3 OR (project_id IS NULL AND $3::uuid IS NULL))
     LIMIT 1`,
    [domain, key, projectId],
  );
  return rows[0] ? mapRow(rows[0]) : null;
}

export async function listDomainMemory(input: {
  domains?: MemoryDomain[];
  projectId?: string | null;
  includeArchived?: boolean;
  limit?: number;
} = {}): Promise<DomainMemoryRecord[]> {
  const sql = getDb();
  const domains = input.domains ?? ['user', 'project', 'decision', 'research', 'operational'];
  const limit = Math.max(1, Math.min(input.limit ?? 200, 500));
  const includeArchived = input.includeArchived ?? true;
  const rows = await sql.unsafe<MemoryRow[]>(
    `${memorySelect}
     WHERE domain = ANY($1::text[])
       AND ($2::boolean OR lifecycle_state = 'current')
       AND (
         $3::uuid IS NULL
         OR project_id = $3
         OR domain IN ('user', 'research', 'operational')
       )
     ORDER BY
       CASE WHEN lifecycle_state = 'current' THEN 0 ELSE 1 END,
       importance DESC,
       updated_at DESC
     LIMIT $4`,
    [domains, includeArchived, input.projectId ?? null, limit],
  );
  return rows.map(mapRow);
}

export async function deleteDomainMemory(id: string): Promise<void> {
  const sql = getDb();
  await sql`DELETE FROM mission_control.memory_records WHERE id = ${id}`;
}

export async function setDomainMemoryImportance(id: string, importance: number): Promise<void> {
  const sql = getDb();
  const normalized = Math.max(1, Math.min(10, importance));
  await sql`
    UPDATE mission_control.memory_records
    SET importance = ${normalized},
        metadata = metadata || ${sql.json({ pinned: normalized >= 9 })},
        updated_at = NOW()
    WHERE id = ${id}
  `;
}

export async function markMemoryAccessed(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const sql = getDb();
  await sql.unsafe(
    `UPDATE mission_control.memory_records
     SET last_accessed_at = NOW()
     WHERE id = ANY($1::uuid[])`,
    [ids],
  );
}

export async function archiveOldDomainMemory(input: {
  olderThan: Date;
  domains?: MemoryDomain[];
}): Promise<number> {
  const sql = getDb();
  const domains = input.domains ?? ['project', 'decision', 'research', 'operational'];
  const result = await sql.unsafe(
    `UPDATE mission_control.memory_records
     SET lifecycle_state = 'archived',
         archived_at = NOW(),
         updated_at = NOW()
     WHERE domain = ANY($1::text[])
       AND lifecycle_state = 'current'
       AND importance < 9
       AND updated_at < $2`,
    [domains, input.olderThan],
  );
  return result.count;
}

export async function getMemoryDomainStats(): Promise<Array<{
  domain: MemoryDomain;
  current: number;
  archived: number;
  latestUpdate: string | null;
}>> {
  const sql = getDb();
  const rows = await sql<{
    domain: MemoryDomain;
    current_count: string | number;
    archived_count: string | number;
    latest_update: Date | null;
  }[]>`
    SELECT domain,
           COUNT(*) FILTER (WHERE lifecycle_state = 'current') AS current_count,
           COUNT(*) FILTER (WHERE lifecycle_state = 'archived') AS archived_count,
           MAX(updated_at) AS latest_update
    FROM mission_control.memory_records
    GROUP BY domain
  `;
  const rowMap = new Map(rows.map((row) => [row.domain, row]));
  const domains: MemoryDomain[] = ['user', 'project', 'decision', 'research', 'operational'];
  return domains.map((domain) => {
    const row = rowMap.get(domain);
    return {
      domain,
      current: Number(row?.current_count ?? 0),
      archived: Number(row?.archived_count ?? 0),
      latestUpdate: row?.latest_update?.toISOString() ?? null,
    };
  });
}
