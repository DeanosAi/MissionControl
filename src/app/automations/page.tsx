import { DashboardShell } from '@/components/dashboard-shell';
import { listAutomations } from '@/lib/automations';
import { listResearchReports } from '@/lib/research-engine/repository';
import { AutomationsClient } from './automations-client';
import { ResearchReports } from './research-reports';

export default async function AutomationsPage() {
  const [automations, reports] = await Promise.all([
    listAutomations().catch(() => []),
    listResearchReports(12).catch(() => []),
  ]);

  return (
    <DashboardShell
      active="automations"
      title="Automations"
      subtitle="Schedule work by capability. Mission Control chooses the model based on value, and weekly research produces review-only technology recommendations."
    >
      <ResearchReports reports={reports} />
      <AutomationsClient initialAutomations={automations} />
    </DashboardShell>
  );
}
