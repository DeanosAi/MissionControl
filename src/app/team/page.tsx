import { DashboardShell } from '@/components/dashboard-shell';
import { SectionHeader } from '@/components/section-header';

const capabilityTeam = [
  {
    name: 'Decision Engine',
    role: 'Central reasoning service',
    status: 'active',
    currentTask: 'Understands intent, retrieves context and memory, compares solutions, critiques them, and recommends one before approval.',
    capabilities: ['Reasoning', 'Planning', 'Product design', 'Architecture', 'Constructive challenge'],
    avatar: 'DE',
  },
  {
    name: 'Product & UI',
    role: 'Experience design capability',
    status: 'active',
    currentTask: 'Turns the recommended approach into a plain-English proposal and an intentionally designed UI concept.',
    capabilities: ['Product planning', 'UX design', 'UI design', 'Acceptance criteria', 'Mobile-first flow'],
    avatar: 'UX',
  },
  {
    name: 'Research Engine',
    role: 'Evidence and technology watch',
    status: 'active',
    currentTask: 'Evaluates changes weekly and produces Recommended, Optional, or Not Recommended reports for review.',
    capabilities: ['Research', 'Technology evaluation', 'Cost review', 'Migration analysis', 'Source provenance'],
    avatar: 'RE',
  },
  {
    name: 'Quality & Risk',
    role: 'Critique capability',
    status: 'active',
    currentTask: 'Tests assumptions against maintainability, security, reliability, cost, and user friction before a recommendation is shown.',
    capabilities: ['Testing', 'Security', 'Risk analysis', 'Reliability', 'Trade-off critique'],
    avatar: 'QA',
  },
  {
    name: 'Capability Router',
    role: 'Model-agnostic provider selection',
    status: 'active',
    currentTask: 'Selects an available model by capability, cost, speed, reliability, context, privacy, locality, and measured performance.',
    capabilities: ['Value routing', 'Cost thresholds', 'Provider fallback', 'Local models', 'Continuous learning'],
    avatar: 'CR',
  },
];

export default function TeamPage() {
  return (
    <DashboardShell
      active="team"
      title="Mission Control capabilities"
      subtitle="The operating roles remain stable while Mission Control chooses whichever approved model can provide each capability best."
    >
      <section className="card page-team-accent">
        <SectionHeader
          title="Capability team"
          subtitle="Roles describe the work. Provider names stay behind the routing layer and can change without redesigning the workflow."
        />
        <div className="team-grid">
          {capabilityTeam.map((member) => (
            <article key={member.name} className="team-card page-team-accent">
              <div className="team-top">
                <div className="team-avatar">{member.avatar}</div>
                <div>
                  <h3>{member.name}</h3>
                  <p>{member.role}</p>
                </div>
                <span className="pill highlight">{member.status}</span>
              </div>
              <p className="team-task">{member.currentTask}</p>
              <div className="pill-row left">
                {member.capabilities.map((capability) => (
                  <span key={capability} className="pill ghost">{capability}</span>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>
    </DashboardShell>
  );
}
