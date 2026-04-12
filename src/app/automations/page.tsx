import { DashboardShell } from '@/components/dashboard-shell';
import { listAutomations } from '@/lib/automations';
import { AutomationsClient } from './automations-client';

export default async function AutomationsPage() {
  const automations = await listAutomations().catch(() => []);

  return (
    <DashboardShell
      active="automations"
      title="Automations"
      subtitle="Schedule recurring tasks with cron-style timing. Auto-generated tasks appear in Current Tasks."
    >
      <AutomationsClient initialAutomations={automations} />
    </DashboardShell>
  );
}
