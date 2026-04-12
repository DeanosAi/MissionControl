import 'server-only';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AnthropicConfig {
  apiKey?: string;
  model?: string;
  maxTokens?: number;
}

const DEFAULT_MODEL = 'claude-opus-4-6';
const DEFAULT_MAX_TOKENS = 2000;

export async function generateChatCompletion(
  messages: ChatMessage[],
  config: AnthropicConfig = {},
): Promise<string> {
  const apiKey = config.apiKey || process.env.ANTHROPIC_API_KEY;
  
  if (!apiKey) {
    throw new Error('Anthropic API key not configured. Set ANTHROPIC_API_KEY environment variable.');
  }

  const model = config.model || DEFAULT_MODEL;
  const maxTokens = config.maxTokens || DEFAULT_MAX_TOKENS;

  // Extract system message
  const systemMessage = messages.find(m => m.role === 'system')?.content || '';
  const conversationMessages = messages
    .filter(m => m.role !== 'system')
    .map(m => ({
      role: m.role,
      content: m.content,
    }));

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      system: systemMessage,
      messages: conversationMessages,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Anthropic API error: ${response.status} ${error}`);
  }

  const data = await response.json();
  const completion = data.content?.[0]?.text;

  if (!completion) {
    throw new Error('No completion returned from Anthropic');
  }

  return completion.trim();
}
