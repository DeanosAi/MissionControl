import Link from 'next/link';

import { DashboardShell } from '@/components/dashboard-shell';
import { DigitalPersona } from '@/components/digital-persona';
import { listAutomations } from '@/lib/automations';
import { listOrchestrationRequests } from '@/lib/conversational-bridge/repository';
import { listDomainMemory } from '@/lib/memory-domains/repository';
import { listProjects } from '@/lib/projects';
import { listResearchReports } from '@/lib/research-engine/repository';
import { listTasks } from '@/lib/tasks';

import styles from './home.module.css';

function formatDate(value: string | null) {
  if (!value) return 'Not yet';
  return new Intl.DateTimeFormat('en-AU', {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value));
}

function greeting() {
  const hour = Number(new Intl.DateTimeFormat('en-AU', {
    hour: '2-digit',
    hour12: false,
    timeZone: 'Australia/Sydney',
  }).format(new Date()));
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

export default async function HomePage() {
  const [tasks, projects, requests, memories, research, automations] = await Promise.all([
    listTasks().catch(() => []),
    listProjects().catch(() => []),
    listOrchestrationRequests(50).catch(() => []),
    listDomainMemory({ includeArchived: false, limit: 12 }).catch(() => []),
    listResearchReports(6).catch(() => []),
    listAutomations().catch(() => []),
  ]);

  const activeProjects = projects
    .filter((project) => ['proposal', 'planning', 'active'].includes(project.status))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const runningTasks = tasks
    .filter((task) => task.status === 'in-progress' || task.status === 'review')
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const approvals = requests.filter((request) => (
    request.status === 'proposal-ready' || request.status === 'cost-approval-required'
  ));
  const activeAutomations = automations.filter((automation) => automation.status === 'active');
  const latestResearch = research[0] ?? null;
  const researchAvailable = Boolean(latestResearch);

  return (
    <DashboardShell
      active="home"
      title="Mission Control"
      subtitle="Your calm daily view of work, decisions, research, and learning."
    >
      <section className={styles.commandCentre}>
        <div className={styles.greeting}>
          <DigitalPersona state={approvals.length > 0 ? 'waiting' : 'greeting'} size="medium" />
          <div>
            <span className={styles.eyebrow}>{greeting()}, Dean</span>
            <h2>{approvals.length > 0 ? `${approvals.length} decision${approvals.length === 1 ? '' : 's'} need your attention.` : 'Everything important is visible.'}</h2>
            <p>
              {runningTasks.length} items are moving, {activeProjects.length} projects are active,
              and weekly research is {researchAvailable ? 'available' : 'not yet available'}.
            </p>
          </div>
        </div>
        <Link className={styles.commandBar} href="/chat">
          <span>Ask Mission Control anything…</span>
          <small>Conversation</small>
          <i aria-hidden="true">⌁</i>
        </Link>
        <p className={styles.voiceNote}>The command surface is voice-ready. Audio input arrives in a future sprint.</p>
      </section>

      <section className={styles.dailyPulse} aria-label="Daily pulse">
        <article data-tone={approvals.length > 0 ? 'attention' : 'calm'}>
          <span>Awaiting approval</span>
          <strong>{approvals.length}</strong>
          <p>{approvals[0]?.projectTitle ?? 'No decisions are waiting.'}</p>
        </article>
        <article>
          <span>Running work</span>
          <strong>{runningTasks.length}</strong>
          <p>{runningTasks[0]?.title ?? 'No tasks are currently moving.'}</p>
        </article>
        <article>
          <span>Projects in progress</span>
          <strong>{activeProjects.length}</strong>
          <p>{activeProjects[0]?.title ?? 'Start with a conversation.'}</p>
        </article>
        <article data-tone={researchAvailable ? 'calm' : 'attention'}>
          <span>Weekly research</span>
          <strong>{researchAvailable ? 'Available' : 'Not run'}</strong>
          <p>{latestResearch ? `Updated ${formatDate(latestResearch.createdAt)}` : 'No report yet.'}</p>
        </article>
      </section>

      <section className={styles.priorityGrid}>
        <article className={styles.focusPanel}>
          <header>
            <div>
              <span className={styles.eyebrow}>Needs your attention</span>
              <h2>Approvals</h2>
            </div>
            <Link href="/chat">Open workspace</Link>
          </header>
          <div className={styles.list}>
            {approvals.length > 0 ? approvals.slice(0, 4).map((request) => (
              <Link href={`/chat#proposal-${request.id}`} className={styles.listItem} key={request.id}>
                <div>
                  <strong>{request.projectTitle}</strong>
                  <p>{request.proposal?.summary ?? request.normalizedIntent}</p>
                </div>
                <span>{request.status === 'cost-approval-required' ? 'Cost' : 'Review'}</span>
              </Link>
            )) : (
              <div className={styles.emptyState}>
                <DigitalPersona state="celebrating" size="small" />
                <div>
                  <strong>You are caught up.</strong>
                  <p>No proposal or cost approval is waiting.</p>
                </div>
              </div>
            )}
          </div>
        </article>

        <article className={styles.focusPanel}>
          <header>
            <div>
              <span className={styles.eyebrow}>In motion</span>
              <h2>Current work</h2>
            </div>
            <Link href="/projects/current-tasks">View tasks</Link>
          </header>
          <div className={styles.list}>
            {runningTasks.length > 0 ? runningTasks.slice(0, 4).map((task) => (
              <div className={styles.listItem} key={task.id}>
                <div>
                  <strong>{task.title}</strong>
                  <p>{task.description}</p>
                </div>
                <span>{task.status.replaceAll('-', ' ')}</span>
              </div>
            )) : (
              <div className={styles.emptyState}>
                <DigitalPersona state="waiting" size="small" />
                <div>
                  <strong>No running tasks.</strong>
                  <p>Approved proposals still stop before execution.</p>
                </div>
              </div>
            )}
          </div>
        </article>
      </section>

      <section className={styles.insightGrid}>
        <article className={styles.focusPanel}>
          <header>
            <div>
              <span className={styles.eyebrow}>Technology watch</span>
              <h2>Weekly research</h2>
            </div>
            <Link href="/memory">Research memory</Link>
          </header>
          {latestResearch ? (
            <div className={styles.researchLead}>
              <div>
                <span data-recommendation={latestResearch.recommendation}>
                  {latestResearch.recommendation.replaceAll('-', ' ')}
                </span>
                <small>{latestResearch.technology}</small>
              </div>
              <h3>{latestResearch.title}</h3>
              <p>{latestResearch.whyItMatters}</p>
              <details>
                <summary>Why Mission Control rated it this way</summary>
                <p>{latestResearch.recommendationRationale}</p>
              </details>
            </div>
          ) : (
            <p className={styles.panelEmpty}>No weekly technology report has been generated yet.</p>
          )}
        </article>

        <article className={styles.focusPanel}>
          <header>
            <div>
              <span className={styles.eyebrow}>Permanent memory</span>
              <h2>Recently learned</h2>
            </div>
            <Link href="/memory">View memory</Link>
          </header>
          <div className={styles.learningList}>
            {memories.length > 0 ? memories.slice(0, 5).map((memory) => (
              <div key={memory.id}>
                <span>{memory.domain}</span>
                <strong>{memory.title}</strong>
                <p>{memory.summary ?? memory.content.slice(0, 150)}</p>
              </div>
            )) : <p className={styles.panelEmpty}>Mission Control has not recorded new learning yet.</p>}
          </div>
        </article>

        <article className={styles.focusPanel}>
          <header>
            <div>
              <span className={styles.eyebrow}>Background activity</span>
              <h2>Automations</h2>
            </div>
            <Link href="/automations">Manage</Link>
          </header>
          <div className={styles.automationList}>
            {activeAutomations.length > 0 ? activeAutomations.slice(0, 5).map((automation) => (
              <div key={automation.id}>
                <i />
                <span>
                  <strong>{automation.title}</strong>
                  <small>{automation.capability} · next {formatDate(automation.nextRun)}</small>
                </span>
              </div>
            )) : <p className={styles.panelEmpty}>No automations are running.</p>}
          </div>
          <div className={styles.boundary}>
            <strong>Approval boundary active</strong>
            <p>Mission Control can think, research, and recommend. New build execution remains off.</p>
          </div>
        </article>
      </section>
    </DashboardShell>
  );
}
