'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import {
  configureProvider,
  listProviderManagementSummaries,
  removeStoredProviderApiKey,
  saveProviderApiKey,
  testAIProviderConnection,
} from '@/lib/ai-providers/service';
import type { AIProviderRecord, ProviderConnectionTestResult } from '@/lib/ai-providers/types';
import { requireAdminSession } from '@/lib/auth/session';
import { createJournalEntry } from '@/lib/journal';

const providerIdSchema = z.string()
  .trim()
  .min(1)
  .max(64)
  .regex(/^[a-z0-9][a-z0-9-]*$/, 'Unknown provider.');
const credentialSchema = z.string().trim().min(8, 'Enter a valid API key.').max(1000, 'The API key is too long.');
const prioritySchema = z.number().int().min(0).max(100);
const usageSchema = z.string().trim().max(500);

export interface ProviderActionResult {
  providers?: AIProviderRecord[];
  credentialStorageEnabled?: boolean;
  test?: ProviderConnectionTestResult;
  message?: string;
  error?: string;
}

async function refreshed(message?: string): Promise<ProviderActionResult> {
  const summary = await listProviderManagementSummaries();
  revalidatePath('/ai-providers');
  revalidatePath('/systems');
  revalidatePath('/');
  return {
    providers: summary.providers,
    credentialStorageEnabled: summary.credentialStorageEnabled,
    message,
  };
}

export async function setProviderEnabledAction(
  providerId: string,
  enabled: boolean,
): Promise<ProviderActionResult> {
  await requireAdminSession();
  const parsed = providerIdSchema.safeParse(providerId);
  if (!parsed.success) return { error: 'Unknown provider.' };

  try {
    await configureProvider({ providerId: parsed.data, enabled });
    await createJournalEntry({
      title: `${enabled ? 'Enabled' : 'Disabled'} AI provider: ${parsed.data}`,
      detail: `AI Provider Management ${enabled ? 'enabled' : 'disabled'} ${parsed.data}. No credential value was recorded.`,
      entryType: 'ops',
      source: 'ai-provider-management',
    });
    return refreshed(`${parsed.data} ${enabled ? 'enabled' : 'disabled'}.`);
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Unable to update the provider.' };
  }
}

export async function updateProviderPreferencesAction(input: {
  providerId: string;
  priorityWeight: number;
  preferredUsage: string;
}): Promise<ProviderActionResult> {
  await requireAdminSession();
  const providerId = providerIdSchema.safeParse(input.providerId);
  const priorityWeight = prioritySchema.safeParse(input.priorityWeight);
  const preferredUsage = usageSchema.safeParse(input.preferredUsage);
  if (!providerId.success || !priorityWeight.success || !preferredUsage.success) {
    return { error: 'Check the provider preference values.' };
  }

  try {
    await configureProvider({
      providerId: providerId.data,
      priorityWeight: priorityWeight.data,
      preferredUsage: preferredUsage.data,
    });
    await createJournalEntry({
      title: `Updated AI provider preference: ${providerId.data}`,
      detail: `Priority weighting is now ${priorityWeight.data}/100. Preferred usage: ${preferredUsage.data || 'No preference supplied'}.`,
      entryType: 'decision',
      source: 'ai-provider-management',
    });
    return refreshed('Provider preferences saved.');
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Unable to save provider preferences.' };
  }
}

export async function saveProviderCredentialAction(
  providerId: string,
  apiKey: string,
): Promise<ProviderActionResult> {
  await requireAdminSession();
  const parsedProvider = providerIdSchema.safeParse(providerId);
  const parsedCredential = credentialSchema.safeParse(apiKey);
  if (!parsedProvider.success) return { error: 'Unknown provider.' };
  if (!parsedCredential.success) {
    return { error: parsedCredential.error.issues[0]?.message ?? 'Enter a valid API key.' };
  }

  try {
    await saveProviderApiKey(parsedProvider.data, parsedCredential.data);
    await createJournalEntry({
      title: `Updated credential for ${parsedProvider.data}`,
      detail: 'An AI provider credential was updated through the encrypted credential store. The secret value was not journaled.',
      entryType: 'ops',
      source: 'ai-provider-management',
    });
    return refreshed('Credential encrypted and saved.');
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Unable to save the credential.' };
  }
}

export async function removeProviderCredentialAction(providerId: string): Promise<ProviderActionResult> {
  await requireAdminSession();
  const parsed = providerIdSchema.safeParse(providerId);
  if (!parsed.success) return { error: 'Unknown provider.' };

  try {
    await removeStoredProviderApiKey(parsed.data);
    await createJournalEntry({
      title: `Removed stored credential for ${parsed.data}`,
      detail: 'The encrypted provider credential was removed. Environment configuration, if present, was not changed.',
      entryType: 'ops',
      source: 'ai-provider-management',
    });
    return refreshed('Stored credential removed.');
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Unable to remove the credential.' };
  }
}

export async function testProviderConnectionAction(providerId: string): Promise<ProviderActionResult> {
  await requireAdminSession();
  const parsed = providerIdSchema.safeParse(providerId);
  if (!parsed.success) return { error: 'Unknown provider.' };

  try {
    const test = await testAIProviderConnection(parsed.data);
    await createJournalEntry({
      title: `AI provider connection test: ${parsed.data}`,
      detail: `${parsed.data} ${test.success ? 'passed' : 'failed'} its connection test in ${test.latencyMs}ms. ${test.message}`,
      entryType: 'ops',
      source: 'ai-provider-management',
    });
    const result = await refreshed(test.message);
    return { ...result, test };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Unable to test the connection.' };
  }
}
