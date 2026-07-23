import 'server-only';

import { generateChatCompletion as generateAnthropicCompletion } from '@/lib/ai/anthropic';
import { isGptAvailable } from '@/lib/ai/gpt-oauth-status';
import { AI_MODELS, type AIModel } from '@/lib/ai/models';
import { generateChatCompletion as generateMoonshotCompletion } from '@/lib/ai/moonshot';
import { generateChatCompletion as generateOpenAICompletion } from '@/lib/ai/openai';
import { generateLocalCompletion, listActiveLocalModels } from '@/lib/local-llm/client';

export type ModelCapability = 'product-planning' | 'conversation';
export type RoutedProvider = 'openai' | 'anthropic' | 'moonshot' | 'local';
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
}

type Candidate = ModelSelection & {
  complete: (messages: RoutedMessage[], maxTokens: number) => Promise<string>;
};

function hasValue(value: string | undefined): boolean {
  return Boolean(value && value.trim());
}

function hostedCandidate(model: AIModel): Candidate {
  return {
    id: model.id,
    name: model.name,
    provider: model.provider,
    complete: (messages, maxTokens) => {
      switch (model.provider) {
        case 'anthropic':
          return generateAnthropicCompletion(messages, { model: model.id, maxTokens });
        case 'moonshot':
          return generateMoonshotCompletion(messages, { model: model.id, maxTokens });
        case 'openai':
          return generateOpenAICompletion(messages, { model: model.id, maxTokens });
      }
    },
  };
}

async function getCandidates(capability: ModelCapability): Promise<Candidate[]> {
  const candidates: Candidate[] = [];
  const anthropicConfigured = hasValue(process.env.ANTHROPIC_API_KEY);
  const moonshotConfigured = hasValue(process.env.MOONSHOT_API_KEY);
  const openAiApiConfigured = hasValue(process.env.OPENAI_API_KEY);
  const openAiOauthConfigured = hasValue(process.env.OPENAI_OAUTH_ENDPOINT);
  const gptAvailable = openAiApiConfigured || (openAiOauthConfigured && await isGptAvailable().catch(() => false));
  const configuredProviders: Record<AIModel['provider'], boolean> = {
    anthropic: anthropicConfigured,
    moonshot: moonshotConfigured,
    openai: gptAvailable,
  };
  const priority = capability === 'product-planning'
    ? ['claude-opus-4-6', 'gpt-5.4', 'claude-sonnet-4-5', 'kimi-k2.5']
    : ['gpt-5.4', 'claude-sonnet-4-5', 'kimi-k2.5', 'claude-opus-4-6'];
  const rank = new Map(priority.map((id, index) => [id, index]));
  const hostedModels = [...AI_MODELS]
    .filter((model) => configuredProviders[model.provider])
    .sort((a, b) => (rank.get(a.id) ?? priority.length) - (rank.get(b.id) ?? priority.length));

  candidates.push(...hostedModels.map(hostedCandidate));

  try {
    const localModels = await listActiveLocalModels();
    for (const local of localModels) {
      candidates.push({
        id: `local:${local.id}`,
        name: local.name,
        provider: 'local',
        complete: (messages, maxTokens) => generateLocalCompletion(local.endpoint, local.modelId, messages, maxTokens),
      });
    }
  } catch {
    // Local models are optional and the V2 table may not exist on older installations.
  }

  return candidates;
}

export async function completeWithCapability(
  capability: ModelCapability,
  buildMessages: (selection: ModelSelection) => RoutedMessage[],
  maxTokens = 4000,
): Promise<RoutedCompletion> {
  const candidates = await getCandidates(capability);
  if (candidates.length === 0) {
    throw new Error('No configured AI model is currently available to Mission Control.');
  }

  const recoveredAttempts: ModelAttempt[] = [];
  for (const candidate of candidates) {
    try {
      const content = await candidate.complete(buildMessages(candidate), maxTokens);
      return {
        content,
        selection: { id: candidate.id, name: candidate.name, provider: candidate.provider },
        recoveredAttempts,
      };
    } catch (error) {
      recoveredAttempts.push({
        modelName: candidate.name,
        provider: candidate.provider,
        error: error instanceof Error ? error.message.slice(0, 500) : 'Unknown model error',
      });
    }
  }

  const attempted = recoveredAttempts.map((attempt) => attempt.modelName).join(', ');
  throw new Error(`Mission Control could not generate a response with the available models (${attempted}).`);
}
