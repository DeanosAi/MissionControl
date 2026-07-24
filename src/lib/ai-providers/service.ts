import 'server-only';

import { generateChatCompletion as generateAnthropicCompletion } from '@/lib/ai/anthropic';
import { checkGptOAuthAvailability } from '@/lib/ai/gpt-oauth-status';
import { generateChatCompletion as generateMoonshotCompletion } from '@/lib/ai/moonshot';
import { listActiveLocalModels, testLocalModelConnection } from '@/lib/local-llm/client';
import {
  canStoreProviderCredentials,
  decryptProviderSecret,
  encryptProviderSecret,
} from './credentials';
import {
  deleteEncryptedProviderCredential,
  getAIProvider,
  getEncryptedProviderCredential,
  listAIProviders,
  recordProviderConnectionTest,
  saveEncryptedProviderCredential,
  updateAIProvider,
} from './repository';
import type { AIProviderRecord, ProviderConnectionTestResult } from './types';

const ENVIRONMENT_CREDENTIALS: Record<string, string> = {
  openai: 'OPENAI_API_KEY',
  anthropic: 'ANTHROPIC_API_KEY',
  moonshot: 'MOONSHOT_API_KEY',
};

export async function listProviderManagementSummaries(): Promise<{
  providers: AIProviderRecord[];
  credentialStorageEnabled: boolean;
}> {
  const providers = await listAIProviders();
  return {
    providers,
    credentialStorageEnabled: canStoreProviderCredentials(),
  };
}

export async function getProviderApiKey(providerId: string): Promise<string | null> {
  const encrypted = await getEncryptedProviderCredential(providerId).catch(() => null);
  if (encrypted) {
    return decryptProviderSecret({
      encryptedSecret: encrypted.encrypted_secret,
      initializationVector: encrypted.initialization_vector,
      authenticationTag: encrypted.authentication_tag,
    });
  }

  const environmentName = ENVIRONMENT_CREDENTIALS[providerId];
  return environmentName ? process.env[environmentName]?.trim() || null : null;
}

export async function providerAvailabilityMap(): Promise<Record<string, boolean>> {
  const providers = await listAIProviders().catch(() => []);
  if (providers.length === 0) {
    const openAiOauth = Boolean(process.env.OPENAI_OAUTH_ENDPOINT?.trim())
      && (await checkGptOAuthAvailability().catch(() => ({ available: false }))).available;
    return {
      openai: Boolean(process.env.OPENAI_API_KEY?.trim()) || openAiOauth,
      anthropic: Boolean(process.env.ANTHROPIC_API_KEY?.trim()),
      moonshot: Boolean(process.env.MOONSHOT_API_KEY?.trim()),
      local: (await listActiveLocalModels().catch(() => [])).length > 0,
    };
  }

  const result: Record<string, boolean> = {};
  for (const provider of providers) {
    if (!provider.enabled) {
      result[provider.id] = false;
      continue;
    }
    if (provider.id === 'local') {
      result.local = (await listActiveLocalModels().catch(() => [])).length > 0;
      continue;
    }
    if (provider.id === 'openai') {
      const oauth = Boolean(process.env.OPENAI_OAUTH_ENDPOINT?.trim())
        && (await checkGptOAuthAvailability().catch(() => ({ available: false }))).available;
      result.openai = provider.credentialConfigured || oauth;
      continue;
    }
    result[provider.id] = provider.credentialConfigured;
  }
  return result;
}

export async function saveProviderApiKey(providerId: string, apiKey: string): Promise<void> {
  const provider = await getAIProvider(providerId);
  if (!provider) throw new Error('Provider not found.');
  if (provider.connectionMode === 'local') {
    throw new Error('Local providers do not use an API key.');
  }

  const encrypted = encryptProviderSecret(apiKey);
  await saveEncryptedProviderCredential({
    provider_id: providerId,
    encrypted_secret: encrypted.encryptedSecret,
    initialization_vector: encrypted.initializationVector,
    authentication_tag: encrypted.authenticationTag,
    fingerprint: encrypted.fingerprint,
  });
}

export async function removeStoredProviderApiKey(providerId: string): Promise<void> {
  await deleteEncryptedProviderCredential(providerId);
}

export async function configureProvider(input: {
  providerId: string;
  enabled?: boolean;
  priorityWeight?: number;
  preferredUsage?: string;
}): Promise<void> {
  await updateAIProvider({
    id: input.providerId,
    enabled: input.enabled,
    priorityWeight: input.priorityWeight,
    preferredUsage: input.preferredUsage,
  });
}

export async function testAIProviderConnection(providerId: string): Promise<ProviderConnectionTestResult> {
  const provider = await getAIProvider(providerId);
  if (!provider) throw new Error('Provider not found.');
  if (!provider.enabled) throw new Error('Enable the provider before testing it.');

  const startedAt = Date.now();
  let success = false;
  let message = '';
  try {
    if (providerId === 'openai') {
      const apiKey = await getProviderApiKey('openai');
      if (apiKey) {
        const response = await fetch('https://api.openai.com/v1/models', {
          headers: { Authorization: `Bearer ${apiKey}` },
          signal: AbortSignal.timeout(10_000),
        });
        if (!response.ok) throw new Error(`OpenAI returned HTTP ${response.status}.`);
        message = 'OpenAI accepted the configured credential.';
      } else {
        const status = await checkGptOAuthAvailability();
        if (!status.available) throw new Error(status.error ?? 'The OpenAI OAuth bridge is unavailable.');
        message = 'The OpenAI OAuth bridge is healthy.';
      }
    } else if (providerId === 'anthropic') {
      const apiKey = await getProviderApiKey('anthropic');
      if (!apiKey) throw new Error('No Anthropic API key is configured.');
      await generateAnthropicCompletion(
        [{ role: 'user', content: 'Reply OK.' }],
        { apiKey, model: 'claude-sonnet-4-5', maxTokens: 2 },
      );
      message = 'Anthropic completed a minimal connection check.';
    } else if (providerId === 'moonshot') {
      const apiKey = await getProviderApiKey('moonshot');
      if (!apiKey) throw new Error('No Moonshot API key is configured.');
      await generateMoonshotCompletion(
        [{ role: 'user', content: 'Reply OK.' }],
        { apiKey, model: 'kimi-k2.5', maxTokens: 2 },
      );
      message = 'Moonshot completed a minimal connection check.';
    } else if (providerId === 'local') {
      const [model] = await listActiveLocalModels();
      if (!model) throw new Error('No active local model is configured.');
      const result = await testLocalModelConnection(model.endpoint, model.modelId);
      if (!result.success) throw new Error(result.error ?? 'The local model did not respond.');
      message = `${model.name} responded successfully.`;
    } else {
      throw new Error(`No connection test is registered for ${provider.displayName}.`);
    }
    success = true;
  } catch (error) {
    message = error instanceof Error ? error.message : 'Connection test failed.';
  }

  const latencyMs = Date.now() - startedAt;
  await recordProviderConnectionTest({
    providerId,
    success,
    latencyMs,
    error: success ? null : message,
  });

  return {
    providerId,
    success,
    latencyMs,
    message,
    checkedAt: new Date().toISOString(),
  };
}

