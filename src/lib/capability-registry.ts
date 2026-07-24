import 'server-only';

import { z } from 'zod';

import { listAIProviders } from '@/lib/ai-providers/repository';
import { providerAvailabilityMap } from '@/lib/ai-providers/service';
import { getDb } from '@/lib/db';
import { listActiveLocalModels } from '@/lib/local-llm/client';

export const capabilitySchema = z.enum([
  'reasoning',
  'planning',
  'coding',
  'research',
  'vision',
  'ui-design',
  'database-design',
  'testing',
  'security',
  'deployment',
  'documentation',
  'conversation',
  'product-planning',
]);

export type Capability = z.infer<typeof capabilitySchema>;
export type CapabilityProvider = 'openai' | 'anthropic' | 'moonshot' | 'local';

export interface RoutingPolicy {
  costThresholdUsd: number;
  weights: {
    quality: number;
    reliability: number;
    cost: number;
    speed: number;
    privacy: number;
    pastPerformance: number;
  };
  preferLocalForPrivate: boolean;
  requireCostApproval: boolean;
}

export interface CapabilityCandidate {
  id: string;
  name: string;
  provider: CapabilityProvider;
  capabilities: Capability[];
  inputCostUsdPerMillion: number | null;
  outputCostUsdPerMillion: number | null;
  estimatedCostUsd: number | null;
  speedScore: number;
  reliabilityScore: number;
  qualityScore: number;
  privacyScore: number;
  providerPriorityScore: number;
  pastPerformanceScore: number;
  contextWindow: number | null;
  isLocal: boolean;
  score: number;
  selectionReason: string;
  localEndpoint?: string;
  localModelId?: string;
}

export interface CapabilityRoutingDecision {
  capability: Capability;
  selected: CapabilityCandidate;
  alternatives: CapabilityCandidate[];
  costThresholdUsd: number;
  requiresCostApproval: boolean;
  estimatedInputTokens: number;
  estimatedOutputTokens: number;
  consideredFactors: string[];
}

type ProfileRow = {
  model_id: string;
  model_name: string;
  provider: string;
  capabilities: string[];
  input_cost_usd_per_million: string | number | null;
  output_cost_usd_per_million: string | number | null;
  speed_score: string | number;
  reliability_score: string | number;
  quality_score: string | number;
  privacy_score: string | number;
  context_window: number | null;
  is_local: boolean;
  enabled: boolean;
};

const DEFAULT_CAPABILITIES = capabilitySchema.options;

const BUILTIN_PROFILES: Record<string, Omit<CapabilityCandidate, 'estimatedCostUsd' | 'pastPerformanceScore' | 'providerPriorityScore' | 'score' | 'selectionReason'>> = {
  'gpt-5.4': {
    id: 'gpt-5.4',
    name: 'GPT-5.4',
    provider: 'openai',
    capabilities: [...DEFAULT_CAPABILITIES],
    inputCostUsdPerMillion: 2.5,
    outputCostUsdPerMillion: 15,
    speedScore: 0.72,
    reliabilityScore: 0.9,
    qualityScore: 0.93,
    privacyScore: 0.65,
    contextWindow: 1_050_000,
    isLocal: false,
  },
  'kimi-k2.5': {
    id: 'kimi-k2.5',
    name: 'Kimi K2.5',
    provider: 'moonshot',
    capabilities: DEFAULT_CAPABILITIES.filter((capability) => capability !== 'deployment'),
    inputCostUsdPerMillion: 0.6,
    outputCostUsdPerMillion: 3,
    speedScore: 0.8,
    reliabilityScore: 0.82,
    qualityScore: 0.82,
    privacyScore: 0.5,
    contextWindow: 262_144,
    isLocal: false,
  },
  'claude-opus-4-6': {
    id: 'claude-opus-4-6',
    name: 'Claude Opus 4.6',
    provider: 'anthropic',
    capabilities: DEFAULT_CAPABILITIES.filter((capability) => capability !== 'deployment'),
    inputCostUsdPerMillion: 5,
    outputCostUsdPerMillion: 25,
    speedScore: 0.48,
    reliabilityScore: 0.88,
    qualityScore: 0.95,
    privacyScore: 0.7,
    contextWindow: 200_000,
    isLocal: false,
  },
  'claude-sonnet-4-5': {
    id: 'claude-sonnet-4-5',
    name: 'Claude Sonnet 4.5',
    provider: 'anthropic',
    capabilities: DEFAULT_CAPABILITIES.filter((capability) => capability !== 'deployment'),
    inputCostUsdPerMillion: 3,
    outputCostUsdPerMillion: 15,
    speedScore: 0.76,
    reliabilityScore: 0.9,
    qualityScore: 0.88,
    privacyScore: 0.7,
    contextWindow: 200_000,
    isLocal: false,
  },
};

const DEFAULT_POLICY: RoutingPolicy = {
  costThresholdUsd: 0.25,
  weights: {
    quality: 0.28,
    reliability: 0.22,
    cost: 0.18,
    speed: 0.12,
    privacy: 0.1,
    pastPerformance: 0.1,
  },
  preferLocalForPrivate: true,
  requireCostApproval: true,
};

function numberValue(value: string | number | null, fallback: number | null = null): number | null {
  if (value === null) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function isProvider(value: string): value is CapabilityProvider {
  return value === 'openai' || value === 'anthropic' || value === 'moonshot' || value === 'local';
}

function parseCapabilities(values: string[]): Capability[] {
  return values
    .map((value) => capabilitySchema.safeParse(value))
    .filter((result): result is { success: true; data: Capability } => result.success)
    .map((result) => result.data);
}

async function getRegistryRows(): Promise<ProfileRow[]> {
  try {
    const sql = getDb();
    return await sql<ProfileRow[]>`
      SELECT model_id, model_name, provider, capabilities,
             input_cost_usd_per_million, output_cost_usd_per_million,
             speed_score, reliability_score, quality_score, privacy_score,
             context_window, is_local, enabled
      FROM mission_control.capability_registry
      WHERE enabled = TRUE
    `;
  } catch {
    return [];
  }
}

export async function getRoutingPolicy(): Promise<RoutingPolicy> {
  try {
    const sql = getDb();
    const [row] = await sql<{
      cost_threshold_usd: string | number;
      weights: unknown;
      prefer_local_for_private: boolean;
      require_cost_approval: boolean;
    }[]>`
      SELECT cost_threshold_usd, weights, prefer_local_for_private, require_cost_approval
      FROM mission_control.routing_policies
      WHERE id = 'default'
      LIMIT 1
    `;
    if (!row) return DEFAULT_POLICY;
    let weights = row.weights;
    if (typeof weights === 'string') {
      try { weights = JSON.parse(weights); } catch { weights = {}; }
    }
    const parsedWeights = weights && typeof weights === 'object'
      ? weights as Partial<RoutingPolicy['weights']>
      : {};
    return {
      costThresholdUsd: numberValue(row.cost_threshold_usd, DEFAULT_POLICY.costThresholdUsd) ?? DEFAULT_POLICY.costThresholdUsd,
      weights: {
        quality: Number(parsedWeights.quality ?? DEFAULT_POLICY.weights.quality),
        reliability: Number(parsedWeights.reliability ?? DEFAULT_POLICY.weights.reliability),
        cost: Number(parsedWeights.cost ?? DEFAULT_POLICY.weights.cost),
        speed: Number(parsedWeights.speed ?? DEFAULT_POLICY.weights.speed),
        privacy: Number(parsedWeights.privacy ?? DEFAULT_POLICY.weights.privacy),
        pastPerformance: Number(parsedWeights.pastPerformance ?? DEFAULT_POLICY.weights.pastPerformance),
      },
      preferLocalForPrivate: row.prefer_local_for_private,
      requireCostApproval: row.require_cost_approval,
    };
  } catch {
    return DEFAULT_POLICY;
  }
}

async function getPastPerformance(modelId: string, capability: Capability): Promise<number> {
  try {
    const sql = getDb();
    const [row] = await sql<{ success_rate: string | number | null }[]>`
      SELECT AVG(CASE WHEN success THEN 1.0 WHEN success = FALSE THEN 0.0 END) AS success_rate
      FROM mission_control.model_routing_events
      WHERE model_id = ${modelId}
        AND capability = ${capability}
        AND created_at > NOW() - INTERVAL '90 days'
    `;
    return numberValue(row?.success_rate ?? null, 0.7) ?? 0.7;
  } catch {
    return 0.7;
  }
}

async function providerAvailability(): Promise<Record<Exclude<CapabilityProvider, 'local'>, boolean>> {
  const availability = await providerAvailabilityMap();
  return {
    openai: Boolean(availability.openai),
    anthropic: Boolean(availability.anthropic),
    moonshot: Boolean(availability.moonshot),
  };
}

function estimateCost(
  inputTokens: number,
  outputTokens: number,
  inputRate: number | null,
  outputRate: number | null,
): number | null {
  if (inputRate === null || outputRate === null) return null;
  return (inputTokens * inputRate + outputTokens * outputRate) / 1_000_000;
}

function costScore(estimatedCost: number | null, threshold: number): number {
  if (estimatedCost === null) return 0.35;
  if (estimatedCost <= 0) return 1;
  return Math.max(0, 1 - estimatedCost / Math.max(threshold, 0.000001));
}

function selectionReason(candidate: CapabilityCandidate, capability: Capability): string {
  const cost = candidate.estimatedCostUsd === null
    ? 'cost is not yet configured'
    : candidate.estimatedCostUsd === 0
      ? 'no per-token API cost is expected'
      : `estimated cost is $${candidate.estimatedCostUsd.toFixed(4)}`;
  return `${candidate.name} supports ${capability}; ${cost}; its value score balances quality, reliability, speed, privacy, context, and recent performance.`;
}

export async function rankCapabilityCandidates(input: {
  capability: Capability;
  estimatedInputTokens: number;
  estimatedOutputTokens: number;
  privacySensitive?: boolean;
  allowLocal?: boolean;
}): Promise<CapabilityRoutingDecision> {
  const [rows, policy, availability, localModels, providers] = await Promise.all([
    getRegistryRows(),
    getRoutingPolicy(),
    providerAvailability(),
    listActiveLocalModels().catch(() => []),
    listAIProviders().catch(() => []),
  ]);
  const rowMap = new Map(rows.map((row) => [row.model_id, row]));
  const providerPriorityMap = new Map(
    providers.map((provider) => [provider.id, provider.priorityWeight / 100]),
  );

  const hosted = Object.values(BUILTIN_PROFILES).flatMap((builtin) => {
    const row = rowMap.get(builtin.id);
    const provider = row && isProvider(row.provider) ? row.provider : builtin.provider;
    if (provider === 'local' || !availability[provider]) return [];
    const capabilities = row ? parseCapabilities(row.capabilities) : builtin.capabilities;
    if (!capabilities.includes(input.capability)) return [];
    return [{
      ...builtin,
      name: row?.model_name ?? builtin.name,
      provider,
      capabilities,
      inputCostUsdPerMillion: numberValue(row?.input_cost_usd_per_million ?? null, builtin.inputCostUsdPerMillion),
      outputCostUsdPerMillion: numberValue(row?.output_cost_usd_per_million ?? null, builtin.outputCostUsdPerMillion),
      speedScore: numberValue(row?.speed_score ?? null, builtin.speedScore) ?? builtin.speedScore,
      reliabilityScore: numberValue(row?.reliability_score ?? null, builtin.reliabilityScore) ?? builtin.reliabilityScore,
      qualityScore: numberValue(row?.quality_score ?? null, builtin.qualityScore) ?? builtin.qualityScore,
      privacyScore: numberValue(row?.privacy_score ?? null, builtin.privacyScore) ?? builtin.privacyScore,
      providerPriorityScore: providerPriorityMap.get(provider) ?? 0.5,
      contextWindow: row?.context_window ?? builtin.contextWindow,
      isLocal: false,
    }];
  });

  const local = (input.allowLocal === false ? [] : localModels).map((model) => ({
    id: `local:${model.id}`,
    name: model.name,
    provider: 'local' as const,
    capabilities: [
      'reasoning',
      'planning',
      'coding',
      'research',
      'ui-design',
      'database-design',
      'testing',
      'documentation',
      'conversation',
      'product-planning',
    ] as Capability[],
    inputCostUsdPerMillion: 0,
    outputCostUsdPerMillion: 0,
    speedScore: 0.62,
    reliabilityScore: 0.68,
    qualityScore: 0.64,
    privacyScore: 1,
    contextWindow: model.contextWindow,
    isLocal: true,
    localEndpoint: model.endpoint,
    localModelId: model.modelId,
    providerPriorityScore: providerPriorityMap.get('local') ?? 0.9,
  })).filter((candidate) => candidate.capabilities.includes(input.capability));

  const baseCandidates = [...hosted, ...local];
  if (baseCandidates.length === 0) {
    throw new Error(`No available model currently provides the ${input.capability} capability.`);
  }

  const scored = await Promise.all(baseCandidates.map(async (candidate) => {
    const estimatedCostUsd = estimateCost(
      input.estimatedInputTokens,
      input.estimatedOutputTokens,
      candidate.inputCostUsdPerMillion,
      candidate.outputCostUsdPerMillion,
    );
    const pastPerformanceScore = await getPastPerformance(candidate.id, input.capability);
    const providerPriorityScore = candidate.providerPriorityScore
      ?? providerPriorityMap.get(candidate.provider)
      ?? 0.5;
    const privacyScore = input.privacySensitive && policy.preferLocalForPrivate && candidate.isLocal
      ? 1
      : candidate.privacyScore;
    const contextScore = candidate.contextWindow
      ? Math.min(1, candidate.contextWindow / Math.max(input.estimatedInputTokens * 2, 1))
      : 0.5;
    const weights = policy.weights;
    const rawScore = (
      candidate.qualityScore * weights.quality
      + candidate.reliabilityScore * weights.reliability
      + costScore(estimatedCostUsd, policy.costThresholdUsd) * weights.cost
      + candidate.speedScore * weights.speed
      + privacyScore * weights.privacy
      + pastPerformanceScore * weights.pastPerformance
    );
    const score = (rawScore * 0.95 + providerPriorityScore * 0.05) * 0.92 + contextScore * 0.08;
    const completeCandidate: CapabilityCandidate = {
      ...candidate,
      estimatedCostUsd,
      pastPerformanceScore,
      providerPriorityScore,
      score,
      selectionReason: '',
    };
    completeCandidate.selectionReason = selectionReason(completeCandidate, input.capability);
    return completeCandidate;
  }));

  scored.sort((a, b) => b.score - a.score);
  const affordable = scored.filter((candidate) => (
    candidate.estimatedCostUsd !== null
    && candidate.estimatedCostUsd <= policy.costThresholdUsd
  ));
  const selected = affordable[0] ?? scored[0];
  const requiresCostApproval = policy.requireCostApproval
    && (
      selected.estimatedCostUsd === null
      || selected.estimatedCostUsd > policy.costThresholdUsd
    );

  return {
    capability: input.capability,
    selected,
    alternatives: scored.filter((candidate) => candidate.id !== selected.id).slice(0, 3),
    costThresholdUsd: policy.costThresholdUsd,
    requiresCostApproval,
    estimatedInputTokens: input.estimatedInputTokens,
    estimatedOutputTokens: input.estimatedOutputTokens,
    consideredFactors: [
      'Capability',
      'Estimated cost',
      'Speed',
      'Reliability',
      'Availability',
      'Context window',
      'Past performance',
      'Local availability',
      'Privacy',
      'Provider priority',
    ],
  };
}

export function serializeRoutingDecision(decision: CapabilityRoutingDecision) {
  const summarize = (candidate: CapabilityCandidate) => ({
    id: candidate.id,
    name: candidate.name,
    provider: candidate.provider,
    estimatedCostUsd: candidate.estimatedCostUsd,
    score: Number(candidate.score.toFixed(5)),
    contextWindow: candidate.contextWindow,
    isLocal: candidate.isLocal,
    selectionReason: candidate.selectionReason,
  });
  return {
    capability: decision.capability,
    selected: summarize(decision.selected),
    alternatives: decision.alternatives.map(summarize),
    costThresholdUsd: decision.costThresholdUsd,
    requiresCostApproval: decision.requiresCostApproval,
    estimatedInputTokens: decision.estimatedInputTokens,
    estimatedOutputTokens: decision.estimatedOutputTokens,
    consideredFactors: decision.consideredFactors,
  };
}
