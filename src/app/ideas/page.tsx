import { DashboardShell } from '@/components/dashboard-shell';
import { IdeasClient } from './ideas-client';

export default async function IdeasPage() {
  return (
    <DashboardShell
      active="ideas"
      title="Ideas"
      subtitle="Submit ideas for capability-routed research into market fit, technical feasibility, competition, and practical estimates."
    >
      <IdeasClient />
    </DashboardShell>
  );
}
