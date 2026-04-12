import { DashboardShell } from '@/components/dashboard-shell';
import { listIdeas } from '@/lib/ideas';
import { IdeasClient } from './ideas-client';

export default async function IdeasPage() {
  const ideas = await listIdeas().catch(() => []);

  return (
    <DashboardShell
      active="ideas"
      title="Ideas"
      subtitle="Submit ideas for AI-powered research. Kimi analyzes market fit, technical feasibility, competition, and generates MVP code."
    >
      <IdeasClient initialIdeas={ideas} />
    </DashboardShell>
  );
}
