import { DashboardShell } from '@/components/dashboard-shell';
import { SectionHeader } from '@/components/section-header';
import { aiBuilds } from '@/lib/data';

export default function AIBuildsPage() {
  return (
    <DashboardShell
      active="ai-builds"
      title="Who is doing what stays visible."
      subtitle="AI Builds keeps model ownership explicit so you can see which model is responsible for each active or future job."
    >
      <section className="card">
        <SectionHeader title="AI Builds" subtitle="Track active work by model so the orchestration stays visible and sane." />
        <div className="stack">
          {aiBuilds.map((job) => (
            <div key={job.id} className="list-row">
              <div>
                <h3>{job.title}</h3>
                <p>{job.summary}</p>
              </div>
              <div className="pill-row align-end">
                <span className="pill highlight">{job.model}</span>
                <span className="pill">{job.status}</span>
              </div>
            </div>
          ))}
        </div>
      </section>
    </DashboardShell>
  );
}
