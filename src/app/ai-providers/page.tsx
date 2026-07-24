import { DashboardShell } from '@/components/dashboard-shell';
import { listProviderManagementSummaries } from '@/lib/ai-providers/service';
import { detectLMStudio, listLocalModels } from '@/lib/local-llm/client';

import { AIProvidersClient } from './providers-client';

export default async function AIProvidersPage() {
  const [summary, localModels, lmStudio] = await Promise.all([
    listProviderManagementSummaries(),
    listLocalModels().catch(() => []),
    detectLMStudio().catch(() => ({ found: false, models: [] as string[] })),
  ]);

  return (
    <DashboardShell
      active="ai-providers"
      title="AI Providers"
      subtitle="Manage connections in one place. Mission Control chooses capabilities by value, not vendor loyalty."
    >
      <AIProvidersClient
        initialProviders={summary.providers}
        credentialStorageEnabled={summary.credentialStorageEnabled}
        initialLocalModels={localModels}
        lmStudioDetected={lmStudio.found}
        lmStudioModels={lmStudio.models}
      />
    </DashboardShell>
  );
}
