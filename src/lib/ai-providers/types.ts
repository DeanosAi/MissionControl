export type ProviderHealthStatus = 'unknown' | 'healthy' | 'degraded' | 'unavailable' | 'disabled';
export type ProviderConnectionMode = 'api-key' | 'oauth-proxy' | 'hybrid' | 'local';
export type ProviderCredentialSource = 'none' | 'environment' | 'encrypted-store';

export interface AIProviderRecord {
  id: string;
  displayName: string;
  adapterType: string;
  connectionMode: ProviderConnectionMode;
  enabled: boolean;
  priorityWeight: number;
  preferredUsage: string;
  estimatedPricing: string;
  strengths: string[];
  weaknesses: string[];
  privacyNotes: string;
  credentialEnvVar: string | null;
  credentialSource: ProviderCredentialSource;
  credentialConfigured: boolean;
  credentialFingerprint: string | null;
  healthStatus: ProviderHealthStatus;
  lastHealthCheckAt: string | null;
  lastSuccessfulCallAt: string | null;
  lastError: string | null;
  capabilities: string[];
  modelCount: number;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface ProviderConnectionTestResult {
  providerId: string;
  success: boolean;
  latencyMs: number;
  message: string;
  checkedAt: string;
}

