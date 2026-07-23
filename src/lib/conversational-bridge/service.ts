import 'server-only';

import { createJournalEntry, getProjectJournalContext } from '@/lib/journal';
import { getMemoryContext } from '@/lib/memory';
import { createProject, getProjectById, listProjects, updateProjectStatus, type ProjectRecord } from '@/lib/projects';
import { classifyProjectRequest, deriveRequestIntent } from '@/lib/conversational-bridge/intent';
import { completeWithCapability } from '@/lib/conversational-bridge/model-router';
import {
  buildFallbackProposal,
  buildProposalMessages,
  formatProposalForJournal,
  parseBridgeModelOutput,
} from '@/lib/conversational-bridge/proposal';
import {
  approveRequest,
  createOrchestrationRequest,
  getOrchestrationRequest,
  markRequestChangesRequested,
  markRequestFailed,
  markRequestPlanning,
  saveRequestProposal,
} from '@/lib/conversational-bridge/repository';
import type { BridgeModelOutput, OrchestrationRequestRecord } from '@/lib/conversational-bridge/types';

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
    source: `conversational-bridge/${input.stage}`,
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

async function generateProposal(input: {
  request: OrchestrationRequestRecord;
  project: ProjectRecord;
  classificationRationale: string;
  revisionFeedback?: string;
  existingOutput?: BridgeModelOutput | null;
}): Promise<{
  output: BridgeModelOutput;
  model: { id: string; name: string; provider: string };
  recoveryNotes: string[];
}> {
  const intent = deriveRequestIntent(input.request.originalRequest);
  const [projectJournalContext, memoryContext] = await Promise.all([
    getProjectJournalContext(input.project.id),
    getMemoryContext(),
  ]);

  const promptInput = {
    request: input.request.originalRequest,
    intent,
    project: input.project,
    classification: input.request.classification,
    classificationRationale: input.classificationRationale,
    projectJournalContext,
    memoryContext,
    revisionFeedback: input.revisionFeedback,
    existingProposal: input.existingOutput,
  };

  try {
    const completion = await completeWithCapability(
      'product-planning',
      () => buildProposalMessages(promptInput),
      5000,
    );

    try {
      return {
        output: parseBridgeModelOutput(completion.content),
        model: completion.selection,
        recoveryNotes: completion.recoveredAttempts.map(
          (attempt) => `${attempt.modelName} failed, so Mission Control recovered with ${completion.selection.name}.`,
        ),
      };
    } catch (parseError) {
      return {
        output: buildFallbackProposal({ request: input.request.originalRequest, intent, project: input.project }),
        model: { id: 'mission-control-fallback', name: 'Mission Control fallback planner', provider: 'internal' },
        recoveryNotes: [
          `The selected planning model returned an invalid proposal shape. Mission Control recovered with its internal approval-first template. ${parseError instanceof Error ? parseError.message : ''}`.trim(),
        ],
      };
    }
  } catch (modelError) {
    return {
      output: buildFallbackProposal({ request: input.request.originalRequest, intent, project: input.project }),
      model: { id: 'mission-control-fallback', name: 'Mission Control fallback planner', provider: 'internal' },
      recoveryNotes: [
        `No configured planning model completed the request. Mission Control recovered with its internal approval-first template. ${modelError instanceof Error ? modelError.message : ''}`.trim(),
      ],
    };
  }
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
      title: 'Conversational request received',
      detail: `${message}\n\nIntent: ${intent.normalizedIntent}\nProject decision: ${resolved.classification.rationale}`,
      stage: 'request',
    });

    if (resolved.projectWasCreated) {
      await writeBridgeJournal({
        projectId: resolved.project.id,
        requestId: request.id,
        title: resolved.classification.classification === 'child-project' ? 'Child project created' : 'Project created',
        detail: `${resolved.project.title} was created automatically in the existing Projects module. No build task was created.`,
        stage: 'project',
      });
    }

    await markRequestPlanning(request.id);
    const generated = await generateProposal({
      request,
      project: resolved.project,
      classificationRationale: resolved.classification.rationale,
    });

    const saved = await saveRequestProposal({
      id: request.id,
      proposal: generated.output.proposal,
      uiPreview: generated.output.uiPreview,
      modelId: generated.model.id,
      modelName: generated.model.name,
      modelProvider: generated.model.provider,
    });

    for (const note of generated.recoveryNotes) {
      await writeBridgeJournal({
        projectId: resolved.project.id,
        requestId: request.id,
        title: 'Planning model recovery',
        detail: note,
        stage: 'recovery',
      });
    }

    await writeBridgeJournal({
      projectId: resolved.project.id,
      requestId: request.id,
      title: `Proposal generated: ${generated.output.proposal.title}`,
      detail: formatProposalForJournal(generated.output),
      entryType: 'decision',
      stage: 'proposal',
    });

    return saved;
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'Unknown orchestration failure';
    await markRequestFailed(request.id, reason).catch(() => undefined);
    await writeBridgeJournal({
      projectId: resolved.project.id,
      requestId: request.id,
      title: 'Proposal generation failed',
      detail: reason,
      stage: 'failure',
    }).catch(() => undefined);
    throw error;
  }
}

export async function reviseConversationProposal(id: string, feedback: string): Promise<OrchestrationRequestRecord> {
  const request = await getOrchestrationRequest(id);
  if (!request || !request.proposal || !request.uiPreview) throw new Error('Proposal not found.');
  if (!['proposal-ready', 'changes-requested'].includes(request.status)) {
    throw new Error('This proposal cannot be revised in its current state.');
  }
  const project = await getProjectById(request.projectId);
  if (!project) throw new Error('Project not found.');

  await markRequestChangesRequested(id, feedback);
  await writeBridgeJournal({
    projectId: project.id,
    requestId: id,
    title: 'Proposal changes requested',
    detail: feedback,
    entryType: 'decision',
    stage: 'feedback',
  });

  const generated = await generateProposal({
    request,
    project,
    classificationRationale: `Revision ${request.revision + 1} keeps the existing project relationship.`,
    revisionFeedback: feedback,
    existingOutput: { proposal: request.proposal, uiPreview: request.uiPreview },
  });

  const saved = await saveRequestProposal({
    id,
    proposal: generated.output.proposal,
    uiPreview: generated.output.uiPreview,
    modelId: generated.model.id,
    modelName: generated.model.name,
    modelProvider: generated.model.provider,
    incrementRevision: true,
  });

  for (const note of generated.recoveryNotes) {
    await writeBridgeJournal({
      projectId: project.id,
      requestId: id,
      title: 'Planning model recovery',
      detail: note,
      stage: 'recovery',
    });
  }

  await writeBridgeJournal({
    projectId: project.id,
    requestId: id,
    title: `Proposal revised: ${generated.output.proposal.title}`,
    detail: formatProposalForJournal(generated.output),
    entryType: 'decision',
    stage: 'proposal-revision',
  });
  return saved;
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
    ? `External tools explicitly approved: ${externalTools.map((choice) => choice.name).join(', ')}.`
    : '';
  const decisionNote = [options.note?.trim(), externalApprovalNote].filter(Boolean).join(' ');
  const approved = await approveRequest(id, decisionNote || null);
  const project = await getProjectById(approved.projectId);
  if (project?.status === 'proposal') {
    await updateProjectStatus(approved.projectId, 'planning');
  }
  await writeBridgeJournal({
    projectId: approved.projectId,
    requestId: approved.id,
    title: `Proposal approved: ${approved.proposal?.title ?? approved.projectTitle}`,
    detail: `${decisionNote || 'The proposal was approved without additional notes.'}\n\nSprint 1 approval boundary reached. No implementation or task execution was started.`,
    entryType: 'decision',
    stage: 'approval',
  });
  return approved;
}
