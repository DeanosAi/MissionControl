import 'server-only';

import { getDb } from '@/lib/db';
import type {
  AIProviderRecord,
  ProviderConnectionMode,
  ProviderCredentialSource,
  ProviderHealthStatus,
} from './types';

type ProviderRow = {
  id: string;
  display_name: string;
  adapter_type: string;
  connection_mode: ProviderConnectionMode;
  enabled: boolean;
  priority_weight: number;
  preferred_usage: string;
  estimated_pricing: string;
  strengths: string[];
  weaknesses: string[];
  privacy_notes: string;
  credential_env_var: string | null;
  credential_source: ProviderCredentialSource;
  credential_fingerprint: string | null;
  health_status: ProviderHealthStatus;
  last_health_check_at: Date | null;
  last_successful_call_at: Date | null;
  last_error: string | null;
  capabilities: string[];
  model_count: number | string;
  metadata: unknown;
  created_at: Date;
  updated_at: Date;
};

type CredentialRow = {
  provider_id: string;
  encrypted_secret: string;
  initialization_vector: string;
  authentication_tag: string;
  fingerprint: string;
};

function metadataValue(value: unknown): Record<string, unknown> {
  if (!value) return {};
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? parsed as Record<string, unknown>
        : {};
    } catch {
      return {};
    }
  }
  return typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function mapProvider(row: ProviderRow): AIProviderRecord {
  const environmentConfigured = row.credential_env_var
    ? Boolean(process.env[row.credential_env_var]?.trim())
    : false;
  const encryptedConfigured = Boolean(row.credential_fingerprint);
  const oauthConfigured = row.id === 'openai' && Boolean(process.env.OPENAI_OAUTH_ENDPOINT?.trim());
  const localConfigured = row.id === 'local';

  return {
    id: row.id,
    displayName: row.display_name,
    adapterType: row.adapter_type,
    connectionMode: row.connection_mode,
    enabled: row.enabled,
    priorityWeight: Number(row.priority_weight),
    preferredUsage: row.preferred_usage,
    estimatedPricing: row.estimated_pricing,
    strengths: row.strengths ?? [],
    weaknesses: row.weaknesses ?? [],
    privacyNotes: row.privacy_notes,
    credentialEnvVar: row.credential_env_var,
    credentialSource: encryptedConfigured
      ? 'encrypted-store'
      : environmentConfigured || oauthConfigured
        ? 'environment'
        : row.credential_source,
    credentialConfigured: environmentConfigured || encryptedConfigured || oauthConfigured || localConfigured,
    credentialFingerprint: row.credential_fingerprint,
    healthStatus: row.enabled ? row.health_status : 'disabled',
    lastHealthCheckAt: row.last_health_check_at?.toISOString() ?? null,
    lastSuccessfulCallAt: row.last_successful_call_at?.toISOString() ?? null,
    lastError: row.last_error,
    capabilities: row.capabilities ?? [],
    modelCount: Number(row.model_count),
    metadata: metadataValue(row.metadata),
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

const providerSelect = `
  SELECT
    providers.id,
    providers.display_name,
    providers.adapter_type,
    providers.connection_mode,
    providers.enabled,
    providers.priority_weight,
    providers.preferred_usage,
    providers.estimated_pricing,
    providers.strengths,
    providers.weaknesses,
    providers.privacy_notes,
    providers.credential_env_var,
    providers.credential_source,
    credentials.fingerprint AS credential_fingerprint,
    providers.health_status,
    providers.last_health_check_at,
    providers.last_successful_call_at,
    providers.last_error,
    COALESCE(registry.capabilities, ARRAY[]::TEXT[]) AS capabilities,
    COALESCE(registry.model_count, 0) AS model_count,
    providers.metadata,
    providers.created_at,
    providers.updated_at
  FROM mission_control.ai_providers providers
  LEFT JOIN mission_control.ai_provider_credentials credentials
    ON credentials.provider_id = providers.id
  LEFT JOIN LATERAL (
    SELECT
      ARRAY(
        SELECT DISTINCT capability
        FROM mission_control.capability_registry provider_models
        CROSS JOIN LATERAL unnest(provider_models.capabilities) capability
        WHERE provider_models.provider = providers.id
          AND provider_models.enabled = TRUE
        ORDER BY capability
      ) AS capabilities,
      (
        SELECT COUNT(*)::INTEGER
        FROM mission_control.capability_registry provider_models
        WHERE provider_models.provider = providers.id
          AND provider_models.enabled = TRUE
      ) AS model_count
  ) registry ON TRUE
`;

export async function listAIProviders(): Promise<AIProviderRecord[]> {
  const sql = getDb();
  const rows = await sql.unsafe<ProviderRow[]>(
    `${providerSelect} ORDER BY providers.priority_weight DESC, providers.display_name`,
  );
  return rows.map(mapProvider);
}

export async function getAIProvider(id: string): Promise<AIProviderRecord | null> {
  const sql = getDb();
  const rows = await sql.unsafe<ProviderRow[]>(
    `${providerSelect} WHERE providers.id = $1 LIMIT 1`,
    [id],
  );
  return rows[0] ? mapProvider(rows[0]) : null;
}

export async function getEncryptedProviderCredential(id: string): Promise<CredentialRow | null> {
  const sql = getDb();
  const [row] = await sql<CredentialRow[]>`
    SELECT provider_id, encrypted_secret, initialization_vector, authentication_tag, fingerprint
    FROM mission_control.ai_provider_credentials
    WHERE provider_id = ${id}
    LIMIT 1
  `;
  return row ?? null;
}

export async function saveEncryptedProviderCredential(input: CredentialRow): Promise<void> {
  const sql = getDb();
  await sql.begin(async (transaction) => {
    await transaction`
      INSERT INTO mission_control.ai_provider_credentials (
        provider_id,
        encrypted_secret,
        initialization_vector,
        authentication_tag,
        fingerprint,
        updated_at
      )
      VALUES (
        ${input.provider_id},
        ${input.encrypted_secret},
        ${input.initialization_vector},
        ${input.authentication_tag},
        ${input.fingerprint},
        NOW()
      )
      ON CONFLICT (provider_id) DO UPDATE SET
        encrypted_secret = EXCLUDED.encrypted_secret,
        initialization_vector = EXCLUDED.initialization_vector,
        authentication_tag = EXCLUDED.authentication_tag,
        fingerprint = EXCLUDED.fingerprint,
        updated_at = NOW()
    `;
    await transaction`
      UPDATE mission_control.ai_providers
      SET credential_source = 'encrypted-store', updated_at = NOW()
      WHERE id = ${input.provider_id}
    `;
  });
}

export async function deleteEncryptedProviderCredential(providerId: string): Promise<void> {
  const sql = getDb();
  await sql.begin(async (transaction) => {
    await transaction`
      DELETE FROM mission_control.ai_provider_credentials
      WHERE provider_id = ${providerId}
    `;
    await transaction`
      UPDATE mission_control.ai_providers
      SET credential_source = CASE
            WHEN credential_env_var IS NULL THEN 'none'
            ELSE 'environment'
          END,
          updated_at = NOW()
      WHERE id = ${providerId}
    `;
  });
}

export async function updateAIProvider(input: {
  id: string;
  enabled?: boolean;
  priorityWeight?: number;
  preferredUsage?: string;
}): Promise<void> {
  const sql = getDb();
  await sql`
    UPDATE mission_control.ai_providers
    SET enabled = COALESCE(${input.enabled ?? null}, enabled),
        priority_weight = COALESCE(${input.priorityWeight ?? null}, priority_weight),
        preferred_usage = COALESCE(${input.preferredUsage ?? null}, preferred_usage),
        health_status = CASE
          WHEN ${input.enabled ?? null} = FALSE THEN 'disabled'
          WHEN ${input.enabled ?? null} = TRUE AND health_status = 'disabled' THEN 'unknown'
          ELSE health_status
        END,
        updated_at = NOW()
    WHERE id = ${input.id}
  `;
}

export async function recordProviderConnectionTest(input: {
  providerId: string;
  success: boolean;
  latencyMs: number;
  error?: string | null;
}): Promise<void> {
  const sql = getDb();
  const safeError = input.error?.slice(0, 800) ?? null;
  await sql.begin(async (transaction) => {
    await transaction`
      INSERT INTO mission_control.ai_provider_connection_tests (
        provider_id, success, latency_ms, error
      )
      VALUES (${input.providerId}, ${input.success}, ${input.latencyMs}, ${safeError})
    `;
    await transaction`
      UPDATE mission_control.ai_providers
      SET health_status = ${input.success ? 'healthy' : 'unavailable'},
          last_health_check_at = NOW(),
          last_error = ${safeError},
          updated_at = NOW()
      WHERE id = ${input.providerId}
    `;
  });
}

export async function recordProviderCallResult(
  providerId: string,
  success: boolean,
  error?: string,
): Promise<void> {
  try {
    const sql = getDb();
    await sql`
      UPDATE mission_control.ai_providers
      SET health_status = ${success ? 'healthy' : 'degraded'},
          last_successful_call_at = CASE WHEN ${success} THEN NOW() ELSE last_successful_call_at END,
          last_error = ${success ? null : error?.slice(0, 800) ?? 'Provider call failed'},
          updated_at = NOW()
      WHERE id = ${providerId}
    `;
  } catch {
    // The stable routing path remains available while the additive migration is rolling out.
  }
}
