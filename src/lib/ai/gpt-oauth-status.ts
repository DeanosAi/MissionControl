import 'server-only';

export interface GptOAuthStatus {
  available: boolean;
  provider: string | null;
  checkedAt: string;
  error: string | null;
}

let cachedStatus: GptOAuthStatus | null = null;
let lastCheckTime = 0;
const CHECK_INTERVAL_MS = 15000; // Re-check every 15 seconds

/**
 * Check if the GPT OAuth proxy is reachable via the SSH tunnel.
 * The proxy runs on Dean's local PC and is tunneled to VPS localhost:3001.
 * Results are cached for 15 seconds to avoid hammering the endpoint.
 */
export async function checkGptOAuthAvailability(): Promise<GptOAuthStatus> {
  const now = Date.now();

  // Return cached result if fresh enough
  if (cachedStatus && now - lastCheckTime < CHECK_INTERVAL_MS) {
    return cachedStatus;
  }

  const endpoint = process.env.OPENAI_OAUTH_ENDPOINT;

  if (!endpoint) {
    cachedStatus = {
      available: false,
      provider: null,
      checkedAt: new Date().toISOString(),
      error: 'OPENAI_OAUTH_ENDPOINT not configured',
    };
    lastCheckTime = now;
    return cachedStatus;
  }

  // Derive health URL from the chat endpoint
  // e.g. http://localhost:3001/chat -> http://localhost:3001/health
  const healthUrl = endpoint.replace(/\/chat\/?$/, '/health');

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000); // 3s timeout

    const response = await fetch(healthUrl, {
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (response.ok) {
      const data = await response.json();
      cachedStatus = {
        available: true,
        provider: data.provider || 'openclaw-oauth',
        checkedAt: new Date().toISOString(),
        error: null,
      };
    } else {
      cachedStatus = {
        available: false,
        provider: null,
        checkedAt: new Date().toISOString(),
        error: `Health check returned ${response.status}`,
      };
    }
  } catch {
    cachedStatus = {
      available: false,
      provider: null,
      checkedAt: new Date().toISOString(),
      error: 'OAuth proxy unreachable (host PC may be offline)',
    };
  }

  lastCheckTime = now;
  return cachedStatus;
}

/** Quick boolean check */
export async function isGptAvailable(): Promise<boolean> {
  const status = await checkGptOAuthAvailability();
  return status.available;
}
