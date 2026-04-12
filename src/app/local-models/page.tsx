import { DashboardShell } from '@/components/dashboard-shell';
import { listLocalModels, detectLMStudio } from '@/lib/local-llm/client';
import { LocalModelsClient } from './local-models-client';

export default async function LocalModelsPage() {
  const [models, lmStudio] = await Promise.all([
    listLocalModels().catch(() => []),
    detectLMStudio().catch(() => ({ found: false, models: [] as string[] })),
  ]);

  return (
    <DashboardShell
      active="local-models"
      title="Local Models"
      subtitle="Add LM Studio or other local LLM models. Test connections and use them in chat and task execution."
    >
      <LocalModelsClient initialModels={models} lmStudioDetected={lmStudio.found} lmStudioModels={lmStudio.models} />
    </DashboardShell>
  );
}
