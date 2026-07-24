import 'server-only';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface OpenAIConfig {
  apiKey?: string;
  model?: string;
  maxTokens?: number;
}

const DEFAULT_MODEL = 'gpt-4o';
const DEFAULT_MAX_TOKENS = 2000;

export async function generateChatCompletion(
  messages: ChatMessage[],
  config: OpenAIConfig = {},
): Promise<string> {
  const model = config.model || DEFAULT_MODEL;
  const maxTokens = config.maxTokens || DEFAULT_MAX_TOKENS;
  const configuredApiKey = config.apiKey?.trim();

  // OAuth endpoint (preferred - uses subscription via tunnel, no API credits)
  const oauthEndpoint = process.env.OPENAI_OAUTH_ENDPOINT;
  
  if (oauthEndpoint && !configuredApiKey) {
    try {
      const response = await fetch(oauthEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages,
          model,
          max_tokens: maxTokens,
        }),
        signal: AbortSignal.timeout(130000), // 130 second timeout
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`OAuth proxy error: ${response.status} ${error}`);
      }

      const data = await response.json();
      
      if (!data.content) {
        throw new Error('No content in OAuth proxy response');
      }

      return data.content.trim();
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      // If it's a connection error (tunnel down), throw with a clear message
      if (msg.includes('fetch failed') || msg.includes('ECONNREFUSED') || msg.includes('abort')) {
        throw new Error(`GPT OAuth proxy is unreachable. Is your host PC on with the tunnel running? (${msg})`);
      }
      // Re-throw other errors (actual API errors from the proxy)
      throw error;
    }
  }

  // Fallback to API key (if configured)
  const apiKey = configuredApiKey || process.env.OPENAI_API_KEY;
  
  if (!apiKey) {
    throw new Error(
      'GPT is not available right now. The OAuth tunnel is not connected and no API key is configured. Start the tunnel on your host PC: .\\scripts\\start-gpt-oauth.ps1'
    );
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: maxTokens,
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI API error: ${response.status} ${error}`);
  }

  const data = await response.json();
  const completion = data.choices?.[0]?.message?.content;

  if (!completion) {
    throw new Error('No completion returned from OpenAI');
  }

  return completion.trim();
}
