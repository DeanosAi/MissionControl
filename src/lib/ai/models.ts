export interface AIModel {
  id: string;
  name: string;
  provider: 'openai' | 'anthropic' | 'moonshot';
  description: string;
  /** If true, this model requires the OAuth proxy tunnel to be active */
  requiresOAuth?: boolean;
  /** Model ID to fall back to if this model is unavailable */
  fallbackModelId?: string;
}

export const AI_MODELS: AIModel[] = [
  {
    id: 'gpt-5.4',
    name: 'GPT-5.4',
    provider: 'openai',
    description: 'OpenAI via OAuth — requires host PC online',
    requiresOAuth: true,
    fallbackModelId: 'kimi-k2.5',
  },
  {
    id: 'kimi-k2.5',
    name: 'Kimi K2.5',
    provider: 'moonshot',
    description: 'Moonshot Kimi - strong reasoning and long context',
  },
  {
    id: 'claude-opus-4-6',
    name: 'Claude Opus 4.6',
    provider: 'anthropic',
    description: 'Most capable Claude model',
  },
  {
    id: 'claude-sonnet-4-5',
    name: 'Claude Sonnet 4.5',
    provider: 'anthropic',
    description: 'Balanced performance and speed',
  },
];

export function getModel(modelId: string): AIModel | undefined {
  return AI_MODELS.find(m => m.id === modelId);
}

export function getDefaultModel(): AIModel {
  return AI_MODELS[0]; // GPT-5.4
}
