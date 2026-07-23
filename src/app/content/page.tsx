import { DashboardShell } from '@/components/dashboard-shell';

export default function ContentPage() {
  return (
    <DashboardShell active="content" title="Content is coming soon." subtitle="The space is reserved, but we are intentionally not locking the structure too early before the content workflow becomes real.">
      <section className="card muted-card page-content-accent">
        <div className="coming-soon">
          <span className="pill">Coming Soon</span>
          <p>When the actual content workflow becomes clearer, this page will grow into its own dashboard without forcing premature structure now.</p>
        </div>
      </section>
    </DashboardShell>
  );
}
