import { DashboardShell } from '@/components/dashboard-shell';
import { IdeasClient } from './ideas-client';

export default async function IdeasPage() {
  return (
    <DashboardShell
      active="ideas"
      title="Ideas"
      subtitle="Submit ideas for AI-powered research. Kimi analyzes market fit, technical feasibility, competition, and generates estimates."
    >
      <IdeasClient />
    </DashboardShell>
  );
}
