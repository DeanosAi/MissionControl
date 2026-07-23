import 'server-only';

import { getDb } from '@/lib/db';

export type ProjectStatus = 'proposal' | 'planning' | 'active' | 'paused' | 'completed' | 'archived';

export interface ProjectRecord {
  id: string;
  title: string;
  slug: string;
  summary: string;
  status: ProjectStatus;
  owner: string;
  parentProjectId: string | null;
  parentProjectTitle: string | null;
  source: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProjectInput {
  title: string;
  summary: string;
  status?: ProjectStatus;
  owner?: string;
  parentProjectId?: string | null;
  source?: string;
}

type ProjectRow = {
  id: string;
  title: string;
  slug: string;
  summary: string;
  status: ProjectStatus;
  owner: string;
  parent_project_id: string | null;
  parent_project_title: string | null;
  source: string;
  created_at: Date;
  updated_at: Date;
};

function mapProjectRow(row: ProjectRow): ProjectRecord {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    summary: row.summary,
    status: row.status,
    owner: row.owner,
    parentProjectId: row.parent_project_id,
    parentProjectTitle: row.parent_project_title,
    source: row.source,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64) || 'project';
}

async function createUniqueSlug(title: string): Promise<string> {
  const sql = getDb();
  const base = slugify(title);
  const rows = await sql<{ slug: string }[]>`
    SELECT slug
    FROM mission_control.projects
    WHERE slug = ${base} OR slug LIKE ${`${base}-%`}
  `;

  const existing = new Set(rows.map((row) => row.slug));
  if (!existing.has(base)) return base;

  let suffix = 2;
  while (existing.has(`${base}-${suffix}`)) suffix += 1;
  return `${base}-${suffix}`;
}

export async function listProjects(includeArchived = false): Promise<ProjectRecord[]> {
  const sql = getDb();
  const rows = includeArchived
    ? await sql<ProjectRow[]>`
        SELECT p.id, p.title, p.slug, p.summary, p.status, p.owner, p.parent_project_id,
               parent.title AS parent_project_title, p.source, p.created_at, p.updated_at
        FROM mission_control.projects p
        LEFT JOIN mission_control.projects parent ON parent.id = p.parent_project_id
        ORDER BY p.created_at ASC
      `
    : await sql<ProjectRow[]>`
        SELECT p.id, p.title, p.slug, p.summary, p.status, p.owner, p.parent_project_id,
               parent.title AS parent_project_title, p.source, p.created_at, p.updated_at
        FROM mission_control.projects p
        LEFT JOIN mission_control.projects parent ON parent.id = p.parent_project_id
        WHERE p.status != 'archived'
        ORDER BY p.created_at ASC
      `;

  return rows.map(mapProjectRow);
}

export async function getProjectById(id: string): Promise<ProjectRecord | null> {
  const sql = getDb();
  const [row] = await sql<ProjectRow[]>`
    SELECT p.id, p.title, p.slug, p.summary, p.status, p.owner, p.parent_project_id,
           parent.title AS parent_project_title, p.source, p.created_at, p.updated_at
    FROM mission_control.projects p
    LEFT JOIN mission_control.projects parent ON parent.id = p.parent_project_id
    WHERE p.id = ${id}
    LIMIT 1
  `;
  return row ? mapProjectRow(row) : null;
}

export async function createProject(input: CreateProjectInput): Promise<ProjectRecord> {
  const sql = getDb();
  const slug = await createUniqueSlug(input.title);
  const [row] = await sql<ProjectRow[]>`
    WITH inserted AS (
      INSERT INTO mission_control.projects (
        title, slug, summary, status, owner, parent_project_id, source
      )
      VALUES (
        ${input.title},
        ${slug},
        ${input.summary},
        ${input.status ?? 'proposal'},
        ${input.owner ?? 'Dean + Mission Control'},
        ${input.parentProjectId ?? null},
        ${input.source ?? 'manual'}
      )
      RETURNING *
    )
    SELECT inserted.id, inserted.title, inserted.slug, inserted.summary, inserted.status,
           inserted.owner, inserted.parent_project_id, parent.title AS parent_project_title,
           inserted.source, inserted.created_at, inserted.updated_at
    FROM inserted
    LEFT JOIN mission_control.projects parent ON parent.id = inserted.parent_project_id
  `;
  return mapProjectRow(row);
}

export async function updateProjectStatus(id: string, status: ProjectStatus): Promise<void> {
  const sql = getDb();
  await sql`
    UPDATE mission_control.projects
    SET status = ${status}, updated_at = NOW()
    WHERE id = ${id}
  `;
}
