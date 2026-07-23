import 'server-only';

import {
  formatProposalForJournal,
} from '@/lib/conversational-bridge/proposal';
import {
  approveRequest,
  approveRequestPlanningCost,
  createOrchestrationRequest,
  getOrchestrationRequest,
  markRequestChangesRequested,
  markRequestCostApprovalRequired,
  markRequestFailed,
  markRequestPlanning,
  saveRequestProposal,
} from '@/lib/conversational-bridge/repository';
import type {
  BridgeModelOutput,
  OrchestrationRequestRecord,
} from '@/lib/conversational-bridge/types';
import {
  recordDecisionOutcome,
} from '@/lib/decision-engine/repository';
import {
  formatDecisionForJournal,
} from '@/lib/decision-engine/output';
import { runDecisionEngine } from '@/lib/decision-engine/service';
import { createJournalEntry } from '@/lib/journal';
import { rememberDecisionMemory } from '@/lib/memory-domains/decision-memory';
import { rememberProjectMemory } from '@/lib/memory-domains/project-memory';
import {
  createProject,
  getProjectById,
  listProjects,
  updateProjectStatus,
  type ProjectRecord,
} from '@/lib/projects';
import {
  classifyProjectRequest,
  deriveRequestIntent,
} from '@/lib/conversational-bridge/intent';

async function writeBridgeJournal(input: {
  projectId: string;
  requestId: string;
  title: string;
  detail: string;
  entryType?: 'auto' | 'decision' | 'note';
  stage: string;
}): Promise<void> {
  await createJournalEntry({
    title: input.title,
    detail: input.detail,
    entryType: input.entryType ?? 'auto',
    source: `decision-engine/${input.stage}`,
    projectId: input.projectId,
    orchestrationRequestId: input.requestId,
  });
}

async function resolveRequestProject(message: string): Promise<{
  project: ProjectRecord;
  classification: ReturnType<typeof classifyProjectRequest>;
  projectWasCreated: boolean;
}> {
  const intent = deriveRequestIntent(message);
  const projects = await listProjects();
  const classification = classifyProjectRequest(message, projects);

  if (classification.classification === 'existing-project' && classification.matchedProject) {
    return { project: classification.matchedProject, classification, projectWasCreated: false };
  }

  const project = await createProject({
    title: intent.projectTitle,
    summary: message,
    status: 'proposal',
    parentProjectId: classification.classification === 'child-project'
      ? classification.matchedProject?.id ?? null
      : null,
    source: 'conversational-bridge',
  });
  return { project, classification, projectWasCreated: true };
}

async function saveCompletedDecision(input: {
  request: OrchestrationRequestRecord;
  project: ProjectRecord;
  generated: Extract<Awaited<ReturnType<typeof runDecisionEngine>>, { status: 'completed' }>;
  incrementRevision?: boolean;
}): Promise<OrchestrationRequestRecord> {
  const saved = await saveRequestProposal({
    id: input.request.id,
    proposal: input.generated.output.proposal,
    uiPreview: input.generated.output.uiPreview,
    decisionAnalysis: input.generated.output.decision,
    routingDecision: input.generated.routingDecision,
    modelId: input.generated.model.id,
    modelName: input.generated.model.name,
    modelProvider: input.generated.model.provider,
    incrementRevision: input.incrementRevision,
  });

  for (const note of input.generated.recoveryNotes) {
    await writeBridgeJournal({
      projectId: input.project.id,
      requestId: input.request.id,
      title: 'Decision Engine recovery',
      detail: note,
      stage: 'recovery',
    });
  }

  const decisionDetail = formatDecisionForJournal(input.generated.output);
  await rememberDecisionMemory({
    key: `decision-${input.request.id}-revision-${saved.revision}`,
    title: `Decision: ${input.generated.output.proposal.title}`,
    content: decisionDetail,
    summary: input.generated.output.decision.recommendation.rationale,
    projectId: input.project.id,
    orchestrationRequestId: input.request.id,
    source: 'decision-engine/recommendation',
    importance: 9,
    metadata: {
      revision: saved.revision,
      selectedOptionId: input.generated.output.decision.recommendation.optionId,
      confidence: input.generated.output.decision.recommendation.confidence,
      alternatives: input.generated.output.decision.options.map((option) => option.id),
      constitutionVersion: saved.constitutionVersion,
    },
  });

  await rememberProjectMemory({
    key: `proposal-${input.request.id}`,
    title: `Current proposal: ${input.generated.output.proposal.title}`,
    content: formatProposalForJournal(input.generated.output),
    summary: input.generated.output.proposal.summary,
    projectId: input.project.id,
    orchestrationRequestId: input.request.id,
    source: 'decision-engine/proposal',
    importance: 8,
    metadata: {
      revision: saved.revision,
      status: 'waiting-for-approval',
    },
  });

  await writeBridgeJournal({
    projectId: input.project.id,
    requestId: input.request.id,
    title: `Decision and proposal generated: ${input.generated.output.proposal.title}`,
    detail: `${decisionDetail}\n\n${formatProposalForJournal(input.generated.output)}`,
    entryType: 'decision',
    stage: 'proposal',
  });

  return saved;
}

async function evaluateRequest(input: {
  request: OrchestrationRequestRecord;
  project: ProjectRecord;
  classificationRationale: string;
  revisionFeedback?: string;
  existingOutput?: BridgeModelOutput | null;
  costApproved?: boolean;
  incrementRevision?: boolean;
}): Promise<OrchestrationRequestRecord> {
  const intent = deriveRequestIntent(input.request.originalRequest);
  const generated = await runDecisionEngine({
    request: input.request,
    project: input.project,
    intent,
    classification: input.request.classification,
    classificationRationale: input.classificationRationale,
    revisionFeedback: input.revisionFeedback,
    existingOutput: input.existingOutput,
    costApproved: input.costApproved,
  });

  if (generated.status === 'cost-approval-required') {
    const paused = await markRequestCostApprovalRequired({
      id: input.request.id,
      routingDecision: generated.routingDecision,
      note: generated.message,
    });
    const alternatives = generated.routingDecision.alternatives
      .map((candidate) => (
        `${candidate.name}: ${candidate.estimatedCostUsd === null ? 'cost unknown' : `$${candidate.estimatedCostUsd.toFixed(4)}`}`
      ))
      .join('; ');
    await writeBridgeJournal({
      projectId: input.project.id,
      requestId: input.request.id,
      title: 'Decision Engine paused for planning-cost approval',
      detail: `${generated.message}\nAlternatives considered: ${alternatives || 'No cheaper configured route is currently available.'}\nNo model call or implementation was started.`,
      entryType: 'decision',
      stage: 'cost-pause',
    });
    return paused;
  }

  return saveCompletedDecision({
    request: input.request,
    project: input.project,
    generated,
    incrementRevision: input.incrementRevision,
  });
}

export async function createProposalFromConversation(message: string): Promise<OrchestrationRequestRecord> {
  const intent = deriveRequestIntent(message);
  const resolved = await resolveRequestProject(message);
  const request = await createOrchestrationRequest({
    projectId: resolved.project.id,
    originalRequest: message,
    normalizedIntent: intent.normalizedIntent,
    classification: resolved.classification.classification,
  });

  try {
    await writeBridgeJournal({
      projectId: resolved.project.id,
      requestId: request.id,
      title: 'Conversational request received by the Decision Engine',
      detail: `${message}\n\nIntent: ${intent.normalizedIntent}\nProject decision: ${resolved.classification.rationale}`,
      stage: 'request',
    });

    if (resolved.projectWasCreated) {
      await writeBridgeJournal({
        projectId: resolved.project.id,
        requestId: request.id,
        title: resolved.classification.classification === 'child-project'
          ? 'Child project created'
          : 'Project created',
        detail: `${resolved.project.title} was created through the existing Projects module. No build task was created.`,
        stage: 'project',
      });
    }

    await markRequestPlanning(request.id);
    return await evaluateRequest({
      request,
      project: resolved.project,
      classificationRationale: resolved.classification.rationale,
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'Unknown Decision Engine failure';
    await markRequestFailed(request.id, reason).catch(() => undefined);
    await writeBridgeJournal({
      projectId: resolved.project.id,
      requestId: request.id,
      title: 'Decision Engine failed',
      detail: reason,
      stage: 'failure',
    }).catch(() => undefined);
    throw error;
  }
}

export async function approveConversationPlanningCost(
  id: string,
): Promise<OrchestrationRequestRecord> {
  const paused = await getOrchestrationRequest(id);
  if (!paused || paused.status !== 'cost-approval-required') {
    throw new Error('This request is not waiting for planning-cost approval.');
  }
  const project = await getProjectById(paused.projectId);
  if (!project) throw new Error('Project not found.');

  const request = await approveRequestPlanningCost(id);
  await writeBridgeJournal({
    projectId: request.projectId,
    requestId: request.id,
    title: 'Planning cost approved',
    detail: `The user explicitly approved the estimated planning cost of ${request.estimatedPlanningCostUsd === null ? 'an unconfigured amount' : `$${request.estimatedPlanningCostUsd.toFixed(4)}`}. This approval permits the Decision Engine analysis only; it does not approve a build.`,
    entryType: 'decision',
    stage: 'cost-approval',
  });
  return evaluateRequest({
    request,
    project,
    classificationRationale: 'The existing project relationship remains unchanged after the cost pause.',
    costApproved: true,
  });
}

export async function reviseConversationProposal(
  id: string,
  feedback: string,
): Promise<OrchestrationRequestRecord> {
  const request = await getOrchestrationRequest(id);
  if (!request || !request.proposal || !request.uiPreview) throw new Error('Proposal not found.');
  if (!['proposal-ready', 'changes-requested'].includes(request.status)) {
    throw new Error('This proposal cannot be revised in its current state.');
  }
  const project = await getProjectById(request.projectId);
  if (!project) throw new Error('Project not found.');

  await markRequestChangesRequested(id, feedback);
  await recordDecisionOutcome({
    orchestrationRequestId: request.id,
    projectId: request.projectId,
    outcomeType: 'changes-requested',
    revision: request.revision,
    selectedOptionId: request.decisionAnalysis?.recommendation.optionId,
    notes: feedback,
  });
  await writeBridgeJournal({
    projectId: project.id,
    requestId: id,
    title: 'Decision and proposal changes requested',
    detail: feedback,
    entryType: 'decision',
    stage: 'feedback',
  });

  return evaluateRequest({
    request,
    project,
    classificationRationale: `Revision ${request.revision + 1} keeps the existing project relationship.`,
    revisionFeedback: feedback,
    existingOutput: {
      proposal: request.proposal,
      uiPreview: request.uiPreview,
    },
    costApproved: Boolean(request.costApprovedAt),
    incrementRevision: true,
  });
}

export async function approveConversationProposal(
  id: string,
  options: { externalToolsApproved?: boolean; note?: string } = {},
): Promise<OrchestrationRequestRecord> {
  const request = await getOrchestrationRequest(id);
  if (!request?.proposal) throw new Error('Proposal not found.');
  const externalTools = request.proposal.technologyChoices.filter(
    (choice) => choice.external && choice.requiresApproval,
  );
  if (externalTools.length > 0 && !options.externalToolsApproved) {
    throw new Error('Explicit approval is required for the proposed external tools.');
  }

  const externalApprovalNote = externalTools.length > 0
    ? `External tools explicitly approved for this proposal: ${externalTools.map((choice) => choice.name).join(', ')}.`
    : '';
  const decisionNote = [options.note?.trim(), externalApprovalNote].filter(Boolean).join(' ');
  const approved = await approveRequest(id, decisionNote || null);
  const project = await getProjectById(approved.projectId);
  if (project?.status === 'proposal') {
    await updateProjectStatus(approved.projectId, 'planning');
  }
  await recordDecisionOutcome({
    orchestrationRequestId: approved.id,
    projectId: approved.projectId,
    outcomeType: 'approved',
    revision: approved.revision,
    selectedOptionId: approved.decisionAnalysis?.recommendation.optionId,
    notes: decisionNote || 'Approved without additional notes.',
    metrics: {
      modelId: approved.selectedModelId,
      estimatedPlanningCostUsd: approved.estimatedPlanningCostUsd,
    },
  });
  await rememberDecisionMemory({
    key: `approval-${approved.id}-revision-${approved.revision}`,
    title: `Approved: ${approved.proposal?.title ?? approved.projectTitle}`,
    content: `${decisionNote || 'The user approved the recommended proposal without additional notes.'}\nNo implementation started. Sprint 1.5 ends at the approval boundary.`,
    summary: 'User approval recorded.',
    projectId: approved.projectId,
    orchestrationRequestId: approved.id,
    source: 'decision-engine/approval',
    importance: 10,
    metadata: {
      revision: approved.revision,
      selectedOptionId: approved.decisionAnalysis?.recommendation.optionId,
      externalToolsApproved: externalTools.length > 0,
    },
  });
  await writeBridgeJournal({
    projectId: approved.projectId,
    requestId: approved.id,
    title: `Proposal approved: ${approved.proposal?.title ?? approved.projectTitle}`,
    detail: `${decisionNote || 'The proposal was approved without additional notes.'}\n\nSprint 1.5 approval boundary reached. No implementation, autonomous coding, task execution, or deployment was started.`,
    entryType: 'decision',
    stage: 'approval',
  });
  return approved;
}
