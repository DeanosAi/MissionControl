import 'server-only';

import { generateChatCompletion as generateAnthropicCompletion } from '@/lib/ai/anthropic';
import { generateChatCompletion as generateMoonshotCompletion } from '@/lib/ai/moonshot';
import { generateChatCompletion as generateOpenAICompletion } from '@/lib/ai/openai';
import {
  type Capability,
  type CapabilityProvider,
  type CapabilityRoutingDecision,
  rankCapabilityCandidates,
  serializeRoutingDecision,
} from '@/lib/capability-registry';
import { getDb } from '@/lib/db';
import { generateLocalCompletion } from '@/lib/local-llm/client';

export type ModelCapability = Capability;
export type RoutedProvider = CapabilityProvider;
export type RoutedMessage = { role: 'system' | 'user' | 'assistant'; content: string };

export interface ModelSelection {
  id: string;
  name: string;
  provider: RoutedProvider;
}

export interface ModelAttempt {
  modelName: string;
  provider: RoutedProvider;
  error: string;
}

export interface RoutedCompletion {
  content: string;
  selection: ModelSelection;
  recoveredAttempts: ModelAttempt[];
  routingDecision: ReturnType<typeof serializeRoutingDecision>;
}

export interface RoutingContext {
  orchestrationRequestId?: string | null;
  projectId?: string | null;
  estimatedInputTokens?: number;
  costApproved?: boolean;
  privacySensitive?: boolean;
}

export class CostApprovalRequiredError extends Error {
  readonly routingDecision: CapabilityRoutingDecision;

  constructor(decision: CapabilityRoutingDecision) {
    const estimate = decision.selected.estimatedCostUsd === null
      ? 'an unconfigured amount'
      : `$${decision.selected.estimatedCostUsd.toFixed(4)}`;
    super(`The best available ${decision.capability} route is estimated to cost ${estimate}, above the $${decision.costThresholdUsd.toFixed(4)} approval threshold.`);
    this.name = 'CostApprovalRequiredError';
    this.routingDecision = decision;
  }
}

function estimateTokens(messages: RoutedMessage[]): number {
  const characters = messages.reduce((total, message) => total + message.content.length, 0);
  return Math.max(1, Math.ceil(characters / 4));
}

async function recordRoutingEvent(input: {
  decision: CapabilityRoutingDecision;
  candidate: CapabilityRoutingDecision['selected'];
  context: RoutingContext;
  success: boolean;
  latencyMs: number;
  error?: string;
}): Promise<void> {
  try {
    const sql = getDb();
    await sql`
      INSERT INTO mission_control.model_routing_events (
        orchestration_request_id, project_id, capability, model_id, model_name,
        provider, estimated_input_tokens, estimated_output_tokens,
        estimated_cost_usd, score, success, latency_ms, error, selection_reason
      )
      VALUES (
        ${input.context.orchestrationRequestId ?? null},
        ${input.context.projectId ?? null},
        ${input.decision.capability},
        ${input.candidate.id},
        ${input.candidate.name},
        ${input.candidate.provider},
        ${input.decision.estimatedInputTokens},
        ${input.decision.estimatedOutputTokens},
        ${input.candidate.estimatedCostUsd},
        ${input.candidate.score},
        ${input.success},
        ${input.latencyMs},
        ${input.error?.slice(0, 1000) ?? null},
        ${input.candidate.selectionReason}
      )
    `;
  } catch {
    // Routing remains available during a rolling migration; the Journal records recovery.
  }
}

async function completeCandidate(
  candidate: CapabilityRoutingDecision['selected'],
  messages: RoutedMessage[],
  maxTokens: number,
): Promise<string> {
  if (candidate.provider === 'anthropic') {
    return generateAnthropicCompletion(messages, { model: candidate.id, maxTokens });
  }
  if (candidate.provider === 'moonshot') {
    return generateMoonshotCompletion(messages, { model: candidate.id, maxTokens });
  }
  if (candidate.provider === 'openai') {
    return generateOpenAICompletion(messages, { model: candidate.id, maxTokens });
  }
  if (!candidate.localEndpoint || !candidate.localModelId) {
    throw new Error(`Local route ${candidate.name} is missing its endpoint configuration.`);
  }
  return generateLocalCompletion(
    candidate.localEndpoint,
    candidate.localModelId,
    messages,
    maxTokens,
  );
}

export async function completeWithCapability(
  capability: ModelCapability,
  buildMessages: (selection: ModelSelection) => RoutedMessage[],
  maxTokens = 4000,
  context: RoutingContext = {},
): Promise<RoutedCompletion> {
  const provisionalTokens = Math.max(1, context.estimatedInputTokens ?? 3000);
  let decision = await rankCapabilityCandidates({
    capability,
    estimatedInputTokens: provisionalTokens,
    estimatedOutputTokens: maxTokens,
    privacySensitive: context.privacySensitive,
  });

  const provisionalSelection: ModelSelection = {
    id: decision.selected.id,
    name: decision.selected.name,
    provider: decision.selected.provider,
  };
  const exactInputTokens = estimateTokens(buildMessages(provisionalSelection));
  if (exactInputTokens !== provisionalTokens) {
    decision = await rankCapabilityCandidates({
      capability,
      estimatedInputTokens: exactInputTokens,
      estimatedOutputTokens: maxTokens,
      privacySensitive: context.privacySensitive,
    });
  }

  if (decision.requiresCostApproval && !context.costApproved) {
    throw new CostApprovalRequiredError(decision);
  }

  const candidates = [decision.selected, ...decision.alternatives];
  const recoveredAttempts: ModelAttempt[] = [];
  for (const candidate of candidates) {
    const selection: ModelSelection = {
      id: candidate.id,
      name: candidate.name,
      provider: candidate.provider,
    };
    const messages = buildMessages(selection);
    const startedAt = Date.now();
    try {
      const content = await completeCandidate(candidate, messages, maxTokens);
      await recordRoutingEvent({
        decision,
        candidate,
        context,
        success: true,
        latencyMs: Date.now() - startedAt,
      });
      return {
        content,
        selection,
        recoveredAttempts,
        routingDecision: serializeRoutingDecision({
          ...decision,
          selected: candidate,
          alternatives: candidates.filter((item) => item.id !== candidate.id),
        }),
      };
    } catch (error) {
      const message = error instanceof Error ? error.message.slice(0, 500) : 'Unknown model error';
      recoveredAttempts.push({
        modelName: candidate.name,
        provider: candidate.provider,
        error: message,
      });
      await recordRoutingEvent({
        decision,
        candidate,
        context,
        success: false,
        latencyMs: Date.now() - startedAt,
        error: message,
      });
    }
  }

  const attempted = recoveredAttempts.map((attempt) => attempt.modelName).join(', ');
  throw new Error(`Mission Control could not complete ${capability} with the available routes (${attempted}).`);
}
