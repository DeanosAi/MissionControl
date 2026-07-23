import 'server-only';

import { getDb } from '@/lib/db';
import {
  proposalSchema,
  uiPreviewSchema,
  type OrchestrationRequestRecord,
  type OrchestrationStatus,
  type ProjectClassification,
  type Proposal,
  type UiPreview,
} from '@/lib/conversational-bridge/types';

type RequestRow = {
  id: string;
  project_id: string;
  project_title: string;
  parent_project_id: string | null;
  parent_project_title: string | null;
  original_request: string;
  normalized_intent: string;
  classification: ProjectClassification;
  status: OrchestrationStatus;
  proposal: unknown;
  ui_preview: unknown;
  selected_model_id: string | null;
  selected_model_name: string | null;
  selected_model_provider: string | null;
  revision: number;
  decision_note: string | null;
  approved_at: Date | null;
  created_at: Date;
  updated_at: Date;
};

function normalizeJson(value: unknown): unknown {
  let current = value;
  for (let attempt = 0; attempt < 2 && typeof current === 'string'; attempt += 1) {
    try {
      current = JSON.parse(current);
    } catch {
      return null;
    }
  }
  return current;
}

function mapRequestRow(row: RequestRow): OrchestrationRequestRecord {
  const proposal = proposalSchema.safeParse(normalizeJson(row.proposal));
  const uiPreview = uiPreviewSchema.safeParse(normalizeJson(row.ui_preview));
  return {
    id: row.id,
    projectId: row.project_id,
    projectTitle: row.project_title,
    parentProjectId: row.parent_project_id,
    parentProjectTitle: row.parent_project_title,
    originalRequest: row.original_request,
    normalizedIntent: row.normalized_intent,
    classification: row.classification,
    status: row.status,
    proposal: proposal.success ? proposal.data : null,
    uiPreview: uiPreview.success ? uiPreview.data : null,
    selectedModelId: row.selected_model_id,
    selectedModelName: row.selected_model_name,
    selectedModelProvider: row.selected_model_provider,
    revision: row.revision,
    decisionNote: row.decision_note,
    approvedAt: row.approved_at?.toISOString() ?? null,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

const requestSelect = `
  SELECT r.id, r.project_id, p.title AS project_title, p.parent_project_id,
         parent.title AS parent_project_title, r.original_request, r.normalized_intent,
         r.classification, r.status, r.proposal, r.ui_preview, r.selected_model_id,
         r.selected_model_name, r.selected_model_provider, r.revision, r.decision_note,
         r.approved_at, r.created_at, r.updated_at
  FROM mission_control.orchestration_requests r
  JOIN mission_control.projects p ON p.id = r.project_id
  LEFT JOIN mission_control.projects parent ON parent.id = p.parent_project_id
`;

export async function createOrchestrationRequest(input: {
  projectId: string;
  originalRequest: string;
  normalizedIntent: string;
  classification: ProjectClassification;
}): Promise<OrchestrationRequestRecord> {
  const sql = getDb();
  const [created] = await sql<{ id: string }[]>`
    INSERT INTO mission_control.orchestration_requests (
      project_id, original_request, normalized_intent, classification
    )
    VALUES (${input.projectId}, ${input.originalRequest}, ${input.normalizedIntent}, ${input.classification})
    RETURNING id
  `;
  const request = await getOrchestrationRequest(created.id);
  if (!request) throw new Error('Mission Control created the request but could not reload it.');
  return request;
}

export async function getOrchestrationRequest(id: string): Promise<OrchestrationRequestRecord | null> {
  const sql = getDb();
  const rows = await sql.unsafe<RequestRow[]>(`${requestSelect} WHERE r.id = $1 LIMIT 1`, [id]);
  return rows[0] ? mapRequestRow(rows[0]) : null;
}

export async function listOrchestrationRequests(limit = 30): Promise<OrchestrationRequestRecord[]> {
  const sql = getDb();
  const safeLimit = Math.max(1, Math.min(limit, 100));
  const rows = await sql.unsafe<RequestRow[]>(`${requestSelect} ORDER BY r.created_at DESC LIMIT $1`, [safeLimit]);
  return rows.map(mapRequestRow);
}

export async function markRequestPlanning(id: string): Promise<void> {
  const sql = getDb();
  await sql`
    UPDATE mission_control.orchestration_requests
    SET status = 'planning', updated_at = NOW()
    WHERE id = ${id}
  `;
}

export async function saveRequestProposal(input: {
  id: string;
  proposal: Proposal;
  uiPreview: UiPreview;
  modelId: string;
  modelName: string;
  modelProvider: string;
  incrementRevision?: boolean;
}): Promise<OrchestrationRequestRecord> {
  const sql = getDb();
  await sql`
    UPDATE mission_control.orchestration_requests
    SET proposal = ${sql.json(input.proposal)},
        ui_preview = ${sql.json(input.uiPreview)},
        selected_model_id = ${input.modelId},
        selected_model_name = ${input.modelName},
        selected_model_provider = ${input.modelProvider},
        status = 'proposal-ready',
        decision_note = NULL,
        revision = revision + ${input.incrementRevision ? 1 : 0},
        updated_at = NOW()
    WHERE id = ${input.id}
  `;
  const request = await getOrchestrationRequest(input.id);
  if (!request) throw new Error('Proposal saved but could not be reloaded.');
  return request;
}

export async function markRequestChangesRequested(id: string, feedback: string): Promise<void> {
  const sql = getDb();
  await sql`
    UPDATE mission_control.orchestration_requests
    SET status = 'changes-requested', decision_note = ${feedback}, updated_at = NOW()
    WHERE id = ${id} AND status IN ('proposal-ready', 'changes-requested')
  `;
}

export async function approveRequest(id: string, note: string | null): Promise<OrchestrationRequestRecord> {
  const sql = getDb();
  const result = await sql`
    UPDATE mission_control.orchestration_requests
    SET status = 'approved', decision_note = ${note}, approved_at = NOW(), updated_at = NOW()
    WHERE id = ${id} AND status = 'proposal-ready'
    RETURNING id
  `;
  if (result.count === 0) throw new Error('Only a proposal that is waiting for approval can be approved.');
  const request = await getOrchestrationRequest(id);
  if (!request) throw new Error('Approval saved but could not be reloaded.');
  return request;
}

export async function markRequestFailed(id: string, reason: string): Promise<void> {
  const sql = getDb();
  await sql`
    UPDATE mission_control.orchestration_requests
    SET status = 'failed', decision_note = ${reason.slice(0, 1000)}, updated_at = NOW()
    WHERE id = ${id}
  `;
}
