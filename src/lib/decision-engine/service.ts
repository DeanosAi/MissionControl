import 'server-only';

import { CONSTITUTION_VERSION } from '@/lib/constitution';
import {
  CostApprovalRequiredError,
  completeWithCapability,
} from '@/lib/conversational-bridge/model-router';
import type {
  BridgeModelOutput,
  OrchestrationRequestRecord,
  ProjectClassification,
  RequestIntent,
  RoutingDecisionSummary,
} from '@/lib/conversational-bridge/types';
import {
  completeDecisionRun,
  createDecisionRun,
  failDecisionRun,
  getDecisionLearningContext,
  pauseDecisionRunForCost,
} from '@/lib/decision-engine/repository';
import {
  buildFallbackDecisionOutput,
  parseDecisionEngineOutput,
} from '@/lib/decision-engine/output';
import { buildDecisionMessages } from '@/lib/decision-engine/prompt';
import type { DecisionEngineOutput } from '@/lib/decision-engine/types';
import { getProjectJournalContext } from '@/lib/journal';
import {
  formatUnifiedMemoryContext,
  retrieveUnifiedMemory,
} from '@/lib/memory-domains/retrieval';
import type { ProjectRecord } from '@/lib/projects';

export type DecisionEngineResult =
  | {
      status: 'completed';
      output: DecisionEngineOutput;
      model: { id: string; name: string; provider: string };
      routingDecision: RoutingDecisionSummary;
      recoveryNotes: string[];
      decisionRunId: string;
    }
  | {
      status: 'cost-approval-required';
      routingDecision: RoutingDecisionSummary;
      decisionRunId: string;
      message: string;
    };

function internalRoutingDecision(): RoutingDecisionSummary {
  return {
    capability: 'product-planning',
    selected: {
      id: 'mission-control-fallback',
      name: 'Mission Control internal decision template',
      provider: 'internal',
      estimatedCostUsd: 0,
      score: 0.5,
      contextWindow: null,
      isLocal: true,
      selectionReason: 'Used after configured AI routes were unavailable or returned an invalid decision shape.',
    },
    alternatives: [],
    costThresholdUsd: 0.25,
    requiresCostApproval: false,
    estimatedInputTokens: 0,
    estimatedOutputTokens: 0,
    consideredFactors: [
      'Safe recovery',
      'No external cost',
      'Approval boundary',
      'Existing architecture',
    ],
  };
}

export async function runDecisionEngine(input: {
  request: OrchestrationRequestRecord;
  project: ProjectRecord;
  intent: RequestIntent;
  classification: ProjectClassification;
  classificationRationale: string;
  revisionFeedback?: string;
  existingOutput?: BridgeModelOutput | null;
  costApproved?: boolean;
}): Promise<DecisionEngineResult> {
  const run = await createDecisionRun({
    orchestrationRequestId: input.request.id,
    projectId: input.project.id,
    revision: input.request.revision + (input.revisionFeedback ? 1 : 0),
    intent: input.intent,
  });

  try {
    const [projectJournalContext, unifiedMemory, learningContext] = await Promise.all([
      getProjectJournalContext(input.project.id),
      retrieveUnifiedMemory({
        query: `${input.request.originalRequest} ${input.intent.normalizedIntent}`,
        projectId: input.project.id,
        orchestrationRequestId: input.request.id,
        limit: 30,
      }),
      getDecisionLearningContext(),
    ]);
    const unifiedMemoryContext = formatUnifiedMemoryContext(unifiedMemory);
    const promptInput = {
      request: input.request.originalRequest,
      intent: input.intent,
      project: input.project,
      classification: input.classification,
      classificationRationale: input.classificationRationale,
      projectJournalContext,
      unifiedMemoryContext,
      learningContext,
      revisionFeedback: input.revisionFeedback,
      existingOutput: input.existingOutput,
    };

    try {
      const completion = await completeWithCapability(
        'product-planning',
        () => buildDecisionMessages(promptInput),
        6500,
        {
          orchestrationRequestId: input.request.id,
          projectId: input.project.id,
          costApproved: input.costApproved,
        },
      );
      let output: DecisionEngineOutput;
      const recoveryNotes = completion.recoveredAttempts.map(
        (attempt) => `${attempt.modelName} failed, so Mission Control recovered with ${completion.selection.name}.`,
      );
      try {
        output = parseDecisionEngineOutput(completion.content);
      } catch (parseError) {
        output = buildFallbackDecisionOutput({
          request: input.request.originalRequest,
          intent: input.intent,
          project: input.project,
          memorySummary: unifiedMemory.explanation,
        });
        recoveryNotes.push(
          `The selected model returned an invalid decision shape. Mission Control used its internal three-option decision template. ${parseError instanceof Error ? parseError.message : ''}`.trim(),
        );
      }
      const routingDecision = completion.routingDecision as RoutingDecisionSummary;
      await completeDecisionRun({
        id: run.id,
        analysis: output.decision,
        routingDecision,
        researchSummary: output.decision.researchSummary,
      });
      return {
        status: 'completed',
        output,
        model: completion.selection,
        routingDecision,
        recoveryNotes,
        decisionRunId: run.id,
      };
    } catch (error) {
      if (error instanceof CostApprovalRequiredError) {
        const routingDecision = {
          ...error.routingDecision,
          selected: {
            ...error.routingDecision.selected,
            localEndpoint: undefined,
            localModelId: undefined,
          },
          alternatives: error.routingDecision.alternatives.map((candidate) => ({
            ...candidate,
            localEndpoint: undefined,
            localModelId: undefined,
          })),
        };
        const serializable = {
          capability: routingDecision.capability,
          selected: routingDecision.selected,
          alternatives: routingDecision.alternatives,
          costThresholdUsd: routingDecision.costThresholdUsd,
          requiresCostApproval: routingDecision.requiresCostApproval,
          estimatedInputTokens: routingDecision.estimatedInputTokens,
          estimatedOutputTokens: routingDecision.estimatedOutputTokens,
          consideredFactors: routingDecision.consideredFactors,
        } as RoutingDecisionSummary;
        await pauseDecisionRunForCost({ id: run.id, routingDecision: serializable });
        return {
          status: 'cost-approval-required',
          routingDecision: serializable,
          decisionRunId: run.id,
          message: error.message,
        };
      }

      const output = buildFallbackDecisionOutput({
        request: input.request.originalRequest,
        intent: input.intent,
        project: input.project,
        memorySummary: unifiedMemory.explanation,
      });
      const routingDecision = internalRoutingDecision();
      await completeDecisionRun({
        id: run.id,
        analysis: output.decision,
        routingDecision,
        researchSummary: output.decision.researchSummary,
      });
      return {
        status: 'completed',
        output,
        model: {
          id: 'mission-control-fallback',
          name: 'Mission Control internal decision template',
          provider: 'internal',
        },
        routingDecision,
        recoveryNotes: [
          `No configured planning route completed the request. Mission Control recovered safely without external cost. ${error instanceof Error ? error.message : ''}`.trim(),
        ],
        decisionRunId: run.id,
      };
    }
  } catch (error) {
    await failDecisionRun(run.id, error instanceof Error ? error.message : 'Unknown Decision Engine failure');
    throw error;
  }
}

export const DECISION_ENGINE_CONSTITUTION_VERSION = CONSTITUTION_VERSION;
