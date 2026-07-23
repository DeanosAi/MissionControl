import 'server-only';

import { getDb } from '@/lib/db';
import type {
  ResearchReportInput,
  ResearchReportRecord,
  ResearchSignal,
} from '@/lib/research-engine/types';

type ResearchReportRow = {
  id: string;
  research_run_id: string;
  category: string;
  technology: string;
  title: string;
  what_changed: string;
  why_it_matters: string;
  advantages: unknown;
  disadvantages: unknown;
  expected_impact: string;
  migration_difficulty: string;
  cost_implications: string;
  recommendation: ResearchReportRecord['recommendation'];
  recommendation_rationale: string;
  change_explanation: string | null;
  source_links: unknown;
  adoption_status: ResearchReportRecord['adoptionStatus'];
  created_at: Date;
  reviewed_at: Date | null;
};

function normalizeStringArray(value: unknown): string[] {
  let current = value;
  for (let attempt = 0; attempt < 2 && typeof current === 'string'; attempt += 1) {
    try { current = JSON.parse(current); } catch { return []; }
  }
  return Array.isArray(current)
    ? current.filter((item): item is string => typeof item === 'string')
    : [];
}

function mapReport(row: ResearchReportRow): ResearchReportRecord {
  return {
    id: row.id,
    researchRunId: row.research_run_id,
    category: row.category,
    technology: row.technology,
    title: row.title,
    whatChanged: row.what_changed,
    whyItMatters: row.why_it_matters,
    advantages: normalizeStringArray(row.advantages),
    disadvantages: normalizeStringArray(row.disadvantages),
    expectedImpact: row.expected_impact,
    migrationDifficulty: row.migration_difficulty,
    costImplications: row.cost_implications,
    recommendation: row.recommendation,
    recommendationRationale: row.recommendation_rationale,
    changeExplanation: row.change_explanation,
    sourceLinks: normalizeStringArray(row.source_links),
    adoptionStatus: row.adoption_status,
    createdAt: row.created_at.toISOString(),
    reviewedAt: row.reviewed_at?.toISOString() ?? null,
  };
}

function toJson(value: unknown): never {
  return JSON.parse(JSON.stringify(value)) as never;
}

export async function createResearchRun(input: {
  trigger: 'weekly' | 'manual' | 'decision-engine';
  topics: string[];
  signals: ResearchSignal[];
}): Promise<string> {
  const sql = getDb();
  const [row] = await sql<{ id: string }[]>`
    INSERT INTO mission_control.research_runs (trigger, topics, source_snapshot)
    VALUES (${input.trigger}, ${input.topics}, ${sql.json(toJson(input.signals))})
    RETURNING id
  `;
  return row.id;
}

export async function completeResearchRun(input: {
  id: string;
  status: 'completed' | 'partial' | 'failed' | 'cost-approval-required';
  summary: string;
  routingDecision?: Record<string, unknown> | null;
  error?: string | null;
}): Promise<void> {
  const sql = getDb();
  await sql`
    UPDATE mission_control.research_runs
    SET status = ${input.status},
        summary = ${input.summary},
        routing_decision = ${input.routingDecision ? sql.json(toJson(input.routingDecision)) : null},
        error = ${input.error?.slice(0, 2000) ?? null},
        completed_at = NOW()
    WHERE id = ${input.id}
  `;
}

export async function saveResearchReports(
  runId: string,
  reports: ResearchReportInput[],
): Promise<ResearchReportRecord[]> {
  const sql = getDb();
  const saved: ResearchReportRecord[] = [];
  for (const report of reports) {
    const [row] = await sql<ResearchReportRow[]>`
      INSERT INTO mission_control.research_reports (
        research_run_id, category, technology, title, what_changed, why_it_matters,
        advantages, disadvantages, expected_impact, migration_difficulty,
        cost_implications, recommendation, recommendation_rationale,
        change_explanation, source_links
      )
      VALUES (
        ${runId}, ${report.category}, ${report.technology}, ${report.title},
        ${report.whatChanged}, ${report.whyItMatters}, ${sql.json(report.advantages)},
        ${sql.json(report.disadvantages)}, ${report.expectedImpact},
        ${report.migrationDifficulty}, ${report.costImplications},
        ${report.recommendation}, ${report.recommendationRationale},
        ${report.changeExplanation ?? null}, ${sql.json(report.sourceLinks)}
      )
      RETURNING *
    `;
    saved.push(mapReport(row));
  }
  return saved;
}

export async function listResearchReports(limit = 30): Promise<ResearchReportRecord[]> {
  const sql = getDb();
  const rows = await sql<ResearchReportRow[]>`
    SELECT *
    FROM mission_control.research_reports
    ORDER BY created_at DESC
    LIMIT ${Math.max(1, Math.min(limit, 100))}
  `;
  return rows.map(mapReport);
}

export async function getPreviousTechnologyRecommendation(technology: string): Promise<ResearchReportRecord | null> {
  const sql = getDb();
  const [row] = await sql<ResearchReportRow[]>`
    SELECT *
    FROM mission_control.research_reports
    WHERE LOWER(technology) = LOWER(${technology})
    ORDER BY created_at DESC
    LIMIT 1
  `;
  return row ? mapReport(row) : null;
}
