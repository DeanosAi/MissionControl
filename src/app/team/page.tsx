import { DashboardShell } from '@/components/dashboard-shell';
import { SectionHeader } from '@/components/section-header';

const team = [
  {
    name: 'Scot',
    role: 'Mission Control AI Assistant',
    model: 'Multi-model (Kimi / Claude)',
    status: 'active',
    currentTask: 'Chat interface, task execution, journal and memory management across all models.',
    capabilities: ['Mission control chat', 'Task execution', 'Journal auto-logging', 'Memory context management'],
    avatar: 'SC',
  },
  {
    name: 'Kimi K2.5',
    role: 'Default Chat & Execution',
    model: 'Kimi K2.5 (Moonshot)',
    status: 'active',
    currentTask: 'Primary chat model and default task execution engine.',
    capabilities: ['General chat', 'Task execution', 'Long context reasoning', 'Cost-efficient default'],
    avatar: 'K2',
  },
  {
    name: 'Claude Sonnet 4.5',
    role: 'Orchestrator',
    model: 'Claude Sonnet 4.5 (Anthropic)',
    status: 'active',
    currentTask: 'Available for orchestration, planning, and task execution.',
    capabilities: ['Task orchestration', 'Planning and review', 'Balanced speed and capability', 'Task execution'],
    avatar: 'S4',
  },
  {
    name: 'Claude Opus 4.6',
    role: 'Deep Reasoning',
    model: 'Claude Opus 4.6 (Anthropic)',
    status: 'active',
    currentTask: 'Reserved for deep analysis, strategy, and high-complexity tasks.',
    capabilities: ['Complex reasoning', 'Strategic planning', 'Deep analysis', 'High-context task execution'],
    avatar: 'O4',
  },
  {
    name: 'GPT-5.4 / Codex',
    role: 'Primary Execution (OAuth)',
    model: 'GPT-5.4 / Codex (OpenAI)',
    status: 'active',
    currentTask: 'Available via OAuth tunnel when host PC is online. Falls back to Kimi K2.5 when offline.',
    capabilities: ['Coding and implementation', 'Codebase edits', 'Technical research', 'OAuth subscription (no API credits)'],
    avatar: 'CX',
  },
];

export default function TeamPage() {
  return (
    <DashboardShell active="team" title="Meet the AI team." subtitle="A dedicated roster for the models involved in Mission Control, including what each one is for and where they fit best.">
      <section className="card page-team-accent">
        <SectionHeader title="Team" subtitle="Roles and responsibilities carried over from the original Mission Control concept." />
        <div className="team-grid">
          {team.map((member) => (
            <article key={member.name} className="team-card page-team-accent">
              <div className="team-top">
                <div className="team-avatar">{member.avatar}</div>
                <div>
                  <h3>{member.name}</h3>
                  <p>{member.role}</p>
                </div>
                <span className="pill highlight">{member.status}</span>
              </div>
              <div className="team-meta team-model-line">
                <span className="micro-copy">Model </span>
                <strong>{member.model}</strong>
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
