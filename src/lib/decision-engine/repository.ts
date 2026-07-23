import 'server-only';

import { getDb } from '@/lib/db';
import type { DecisionAnalysis, DecisionRunRecord } from '@/lib/decision-engine/types';
import type { RequestIntent, RoutingDecisionSummary } from '@/lib/conversational-bridge/types';

type DecisionRunRow = {
  id: string;
  orchestration_request_id: string;
  project_id: string;
  revision: number;
  status: DecisionRunRecord['status'];
  started_at: Date;
  completed_at: Date | null;
};

function mapRun(row: DecisionRunRow): DecisionRunRecord {
  return {
    id: row.id,
    orchestrationRequestId: row.orchestration_request_id,
    projectId: row.project_id,
    revision: row.revision,
    status: row.status,
    startedAt: row.started_at.toISOString(),
    completedAt: row.completed_at?.toISOString() ?? null,
  };
}

function toJson(value: unknown): never {
  return JSON.parse(JSON.stringify(value)) as never;
}

export async function createDecisionRun(input: {
  orchestrationRequestId: string;
  projectId: string;
  revision: number;
  intent: RequestIntent;
}): Promise<DecisionRunRecord> {
  const sql = getDb();
  const [row] = await sql<DecisionRunRow[]>`
    INSERT INTO mission_control.decision_runs (
      orchestration_request_id, project_id, revision, intent
    )
    VALUES (
      ${input.orchestrationRequestId},
      ${input.projectId},
      ${input.revision},
      ${sql.json(toJson(input.intent))}
    )
    RETURNING id, orchestration_request_id, project_id, revision, status, started_at, completed_at
  `;
  return mapRun(row);
}

export async function completeDecisionRun(input: {
  id: string;
  analysis: DecisionAnalysis;
  routingDecision: RoutingDecisionSummary;
  researchSummary: string;
}): Promise<void> {
  const sql = getDb();
  await sql`
    UPDATE mission_control.decision_runs
    SET status = 'completed',
        context_summary = ${sql.json({
          understoodIntent: input.analysis.understoodIntent,
          contextSummary: input.analysis.contextSummary,
          memorySummary: input.analysis.memorySummary,
        })},
        alternatives = ${sql.json(input.analysis.options)},
        critique = ${sql.json(input.analysis.critique)},
        recommendation = ${sql.json(input.analysis.recommendation)},
        routing_decision = ${sql.json(input.routingDecision)},
        research_summary = ${input.researchSummary},
        completed_at = NOW()
    WHERE id = ${input.id}
  `;
}

export async function pauseDecisionRunForCost(input: {
  id: string;
  routingDecision: RoutingDecisionSummary;
}): Promise<void> {
  const sql = getDb();
  await sql`
    UPDATE mission_control.decision_runs
    SET status = 'cost-approval-required',
        routing_decision = ${sql.json(input.routingDecision)},
        completed_at = NOW()
    WHERE id = ${input.id}
  `;
}

export async function failDecisionRun(id: string, error: string): Promise<void> {
  const sql = getDb();
  await sql`
    UPDATE mission_control.decision_runs
    SET status = 'failed',
        error = ${error.slice(0, 2000)},
        completed_at = NOW()
    WHERE id = ${id}
  `;
}

export async function recordDecisionOutcome(input: {
  orchestrationRequestId: string;
  projectId: string;
  outcomeType: 'approved' | 'changes-requested' | 'rejected' | 'completed' | 'failed';
  revision: number;
  selectedOptionId?: string | null;
  notes?: string | null;
  metrics?: Record<string, unknown>;
}): Promise<void> {
  const sql = getDb();
  await sql`
    INSERT INTO mission_control.decision_outcomes (
      orchestration_request_id, project_id, outcome_type, revision,
      selected_option_id, notes, metrics
    )
    VALUES (
      ${input.orchestrationRequestId},
      ${input.projectId},
      ${input.outcomeType},
      ${input.revision},
      ${input.selectedOptionId ?? null},
      ${input.notes ?? null},
      ${sql.json(toJson(input.metrics ?? {}))}
    )
  `;
}

export async function getDecisionLearningContext(limit = 20): Promise<string> {
  try {
    const sql = getDb();
    const rows = await sql<{
      outcome_type: string;
      selected_option_id: string | null;
      notes: string | null;
      created_at: Date;
    }[]>`
      SELECT outcome_type, selected_option_id, notes, created_at
      FROM mission_control.decision_outcomes
      ORDER BY created_at DESC
      LIMIT ${Math.max(1, Math.min(limit, 100))}
    `;
    if (rows.length === 0) return 'No measured decision outcomes are available yet.';
    return [
      'Recent measurable decision outcomes:',
      ...rows.map((row) => (
        `- ${row.created_at.toISOString().split('T')[0]}: ${row.outcome_type}`
        + `${row.selected_option_id ? `; option ${row.selected_option_id}` : ''}`
        + `${row.notes ? `; ${row.notes}` : ''}`
      )),
    ].join('\n');
  } catch {
    return 'Decision outcome history is not available yet.';
  }
}
