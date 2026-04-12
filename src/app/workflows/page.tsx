import { DashboardShell } from '@/components/dashboard-shell';
import { WorkflowsClient } from './workflows-client';

export default async function WorkflowsPage() {
  return (
    <DashboardShell
      active="automations"
      title="Workflows"
      subtitle="Connect to N8N for advanced automation workflows. Trigger image generation, newsletter processing, and custom pipelines."
    >
      <WorkflowsClient />
    </DashboardShell>
  );
}
