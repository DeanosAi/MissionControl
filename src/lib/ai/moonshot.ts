import 'server-only';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface MoonshotConfig {
  apiKey?: string;
  model?: string;
  maxTokens?: number;
}

const DEFAULT_MODEL = 'kimi-k2.5';
const DEFAULT_MAX_TOKENS = 2000;

export async function generateChatCompletion(
  messages: ChatMessage[],
  config: MoonshotConfig = {},
): Promise<string> {
  const apiKey = config.apiKey || process.env.MOONSHOT_API_KEY;

  if (!apiKey) {
    throw new Error('Moonshot API key not configured. Set MOONSHOT_API_KEY environment variable.');
  }

  const model = config.model || DEFAULT_MODEL;
  const maxTokens = config.maxTokens || DEFAULT_MAX_TOKENS;

  const temperature = model === 'kimi-k2.5' ? 1 : 0.7;

  const response = await fetch('https://api.moonshot.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: maxTokens,
      temperature,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Moonshot API error: ${response.status} ${error}`);
  }

  const data = await response.json();
  const completion = data.choices?.[0]?.message?.content;

  if (!completion) {
    throw new Error('No completion returned from Moonshot');
  }

  return completion.trim();
}
