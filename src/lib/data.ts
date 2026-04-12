export type DashboardKey =
  | 'home'
  | 'ideas'
  | 'projects'
  | 'ai-builds'
  | 'chat'
  | 'usage'
  | 'team'
  | 'tools'
  | 'systems'
  | 'automations'
  | 'memory'
  | 'content';

export interface NavItem {
  key: DashboardKey;
  label: string;
  href: string;
  badge?: string;
}

export interface Idea {
  id: string;
  title: string;
  summary: string;
  status: 'captured' | 'exploring' | 'ready';
  tags: string[];
}

export interface SuggestedIdea {
  id: string;
  title: string;
  source: string;
  reason: string;
  status: 'queued' | 'reviewing';
}

export interface ProjectItem {
  id: string;
  title: string;
  status: 'planning' | 'active' | 'blocked';
  summary: string;
  owner: string;
}

export interface ProjectTask {
  id: string;
  title: string;
  description: string;
  status: 'backlog' | 'in-progress' | 'review' | 'done';
  priority: 'low' | 'medium' | 'high';
}

export interface AIBuild {
  id: string;
  title: string;
  model: 'GPT-5.4' | 'Sonnet' | 'Opus' | 'Codex' | 'Kimi';
  status: 'queued' | 'active' | 'review' | 'done';
  summary: string;
}

export interface JournalEntry {
  id: string;
  title: string;
  date: string;
  detail: string;
  type: 'milestone' | 'ops' | 'decision';
}

export const navItems: NavItem[] = [
  { key: 'home', label: 'Home', href: '/' },
  { key: 'ideas', label: 'Ideas', href: '/ideas' },
  { key: 'projects', label: 'Projects', href: '/projects' },
  { key: 'ai-builds', label: 'AI Builds', href: '/ai-builds' },
  { key: 'chat', label: 'Chat', href: '/chat' },
  { key: 'usage', label: 'Usage & Limits', href: '/usage' },
  { key: 'team', label: 'Team', href: '/team' },
  { key: 'tools', label: 'Tools', href: '/tools' },
  { key: 'systems', label: 'Systems', href: '/systems' },
  { key: 'automations', label: 'Automations', href: '/automations' },
  { key: 'memory', label: 'Memory / Journal', href: '/memory' },
  { key: 'content', label: 'Content', href: '/content', badge: 'Soon' },
];

export const ideas: Idea[] = [
  {
    id: 'idea-1',
    title: 'Mission Control platform shell',
    summary: 'Establish the modular shell that future tools and dashboards can plug into cleanly.',
    status: 'ready',
    tags: ['platform', 'core', 'v1'],
  },
  {
    id: 'idea-2',
    title: 'Agent-powered opportunity scanner',
    summary: 'Let an agent periodically scan for new product or tool ideas and surface them as suggested ideas.',
    status: 'exploring',
    tags: ['agents', 'ideas', 'automation'],
  },
  {
    id: 'idea-3',
    title: 'System health command deck',
    summary: 'Show VPS health, deployment status, backups, and important operational alerts in one place.',
    status: 'captured',
    tags: ['ops', 'systems'],
  },
];

export const suggestedIdeas: SuggestedIdea[] = [
  {
    id: 'suggested-1',
    title: 'Trend-to-tool builder',
    source: 'Future agent scan',
    reason: 'A natural fit once scanning is enabled and we want a queue of promising product opportunities.',
    status: 'queued',
  },
  {
    id: 'suggested-2',
    title: 'Build debrief generator',
    source: 'Future agent scan',
    reason: 'Could convert long implementation work into clear release notes and lessons learned.',
    status: 'reviewing',
  },
];

export const projects: ProjectItem[] = [
  {
    id: 'project-1',
    title: 'Mission Control',
    status: 'active',
    summary: 'Private self-hosted builder OS for ideas, projects, AI builds, systems, automations, and memory.',
    owner: 'Dean + Scot',
  },
  {
    id: 'project-2',
    title: 'Backup architecture',
    status: 'planning',
    summary: 'Nightly compressed backups on the server with resilient local sync that never breaks runtime.',
    owner: 'Scot',
  },
  {
    id: 'project-3',
    title: 'Content dashboard module',
    status: 'planning',
    summary: 'Reserved for later once real content workflows are clearer.',
    owner: 'Dean',
  },
];

export const projectTasks: ProjectTask[] = [
  {
    id: 'task-1',
    title: 'Refactor app into multi-page shell',
    description: 'Split the one-page dashboard into route-based pages with a cleaner home overview.',
    status: 'done',
    priority: 'high',
  },
  {
    id: 'task-2',
    title: 'Add project kanban board',
    description: 'Mirror the original Mission Control board style for tracking project tasks.',
    status: 'done',
    priority: 'high',
  },
  {
    id: 'task-3',
    title: 'Milestone C - Usage monitoring reliability',
    description: 'Finish and verify the 10-minute usage monitoring automation so snapshot refresh survives reboot/login cleanly, remains fresh without manual nudging, and exposes stale-data state when needed.',
    status: 'done',
    priority: 'high',
  },
  {
    id: 'task-4',
    title: 'Milestone C - Multi-model chat stabilization',
    description: 'Stabilize Kimi K2.5, Claude Sonnet 4.5, and Claude Opus 4.6 so routing, attribution, and live in-thread updates are consistently correct.',
    status: 'done',
    priority: 'high',
  },
  {
    id: 'task-5',
    title: 'Milestone C - Current Tasks stability pass',
    description: 'Complete the final regression and usability pass on Current Tasks so create/edit/delete/drag and AI assignment remain stable in live use.',
    status: 'done',
    priority: 'medium',
  },
  {
    id: 'task-6',
    title: 'Milestone D - Task execution engine',
    description: 'Build the first real execution flow so a task can be run from Mission Control by the selected model, produce output, and update task state through execution.',
    status: 'done',
    priority: 'high',
  },
  {
    id: 'task-7',
    title: 'Milestone E - Chat to task integration',
    description: 'Let chat create, assign, reference, and run tasks so the conversation interface becomes the control surface for Mission Control execution.',
    status: 'done',
    priority: 'high',
  },
  {
    id: 'task-8',
    title: 'Milestone F - Memory and continuity',
    description: 'Build daily journal automation and shared AI-readable continuity so future model runs understand current work without being re-explained from scratch.',
    status: 'done',
    priority: 'high',
  },
  {
    id: 'task-9',
    title: 'Milestone G - Operations and resilience',
    description: 'Add backup automation, health visibility, and recovery/admin tooling so the VPS app is sustainable and safe to operate long-term.',
    status: 'done',
    priority: 'high',
  },
  {
    id: 'task-10',
    title: 'Milestone H - Final polish and completion pass',
    description: 'Run the final UX, consistency, and completion verification pass so Mission Control feels coherent, dependable, and finished across chat, tasks, memory, monitoring, and operations.',
    status: 'done',
    priority: 'medium',
  },
  {
    id: 'task-11',
    title: 'Current Tasks and usage monitoring usable live',
    description: 'Current Tasks interaction bugs are fixed, usage monitoring surfaces now exist, and the live deployment can be used for ongoing desk-side monitoring and operations.',
    status: 'done',
    priority: 'high',
  },
];

export const aiBuilds: AIBuild[] = [
  {
    id: 'build-1',
    title: 'App shell and routed dashboard pages',
    model: 'Codex',
    status: 'active',
    summary: 'Heavy implementation work for the route-based app structure and section pages.',
  },
  {
    id: 'build-2',
    title: 'QA and deployment verification',
    model: 'Sonnet',
    status: 'review',
    summary: 'Orchestration, validation, and checking that the live app matches the agreed product direction.',
  },
  {
    id: 'build-3',
    title: 'Suggested idea scan module',
    model: 'GPT-5.4',
    status: 'queued',
    summary: 'Future suggested-ideas system that can scan for promising things to build.',
  },
  {
    id: 'build-4',
    title: 'Deep strategy / architecture review',
    model: 'Opus',
    status: 'queued',
    summary: 'Reserved for occasional higher-cost review passes only when truly useful.',
  },
];

export const tools = [
  'Mission Control VPS — self-hosted builder OS at app.missioncontroldb.online',
  'Kimi K2.5 (Moonshot) — default chat and task execution model',
  'Claude Sonnet 4.5 (Anthropic) — orchestration and review',
  'Claude Opus 4.6 (Anthropic) — deep reasoning and strategy',
  'Postgres 17 — persistent storage for tasks, journal, memory, chat, executions',
  'Docker + Caddy — containerized deployment with HTTPS',
  'Host-side usage monitor — Windows PowerShell refresh loop via SSH',
  'Backup scripts — automated nightly dump with restore capability',
];

export const systems = [
  { label: 'Environment', value: 'Contabo Ubuntu 24.04 VPS' },
  { label: 'Domain', value: 'app.missioncontroldb.online' },
  { label: 'Security', value: 'Key-only SSH, UFW, unattended upgrades, Fail2ban' },
  { label: 'Runtime', value: 'Next.js in Docker with Caddy HTTPS' },
];

export const automations = [
  'Usage monitoring — 10-minute host-to-VPS snapshot refresh with staleness detection',
  'Auto-journaling — tasks create journal entries on execution, creation, and completion',
  'AI context injection — tasks, journal, and memory are injected into every chat prompt',
  'Nightly VPS backup — Postgres dump with 7-day rolling retention (cron)',
  'System health monitoring — 30-second auto-refresh on the Systems dashboard',
  'Journal seeding — hardcoded entries auto-migrate to DB on first Memory page visit',
];

export const journalEntries: JournalEntry[] = [
  {
    id: 'journal-1',
    title: 'VPS hardened for deployment baseline',
    date: '2026-04-09',
    detail: 'Created admin user, enabled key-only SSH, disabled root and password SSH, enabled UFW, verified unattended upgrades, and installed Fail2ban.',
    type: 'ops',
  },
  {
    id: 'journal-2',
    title: 'Mission Control direction agreed',
    date: '2026-04-09',
    detail: 'Locked in the builder-OS direction with modular dashboards for ideas, projects, AI builds, systems, automations, and memory.',
    type: 'decision',
  },
  {
    id: 'journal-3',
    title: 'First live deployment completed',
    date: '2026-04-09',
    detail: 'The hosted app was containerized, deployed to the VPS, and exposed publicly behind HTTPS.',
    type: 'milestone',
  },
  {
    id: 'journal-4',
    title: 'Design feedback entered',
    date: '2026-04-09',
    detail: 'Shifted from a single long page to a multi-page dashboard concept, introduced a richer neon palette, and promoted Projects into a dedicated kanban page.',
    type: 'decision',
  },
  {
    id: 'journal-5',
    title: 'Blue-led brand pass started',
    date: '2026-04-09',
    detail: 'Palette shifted toward dark neon blue, team page added, and a logo asset plus usage status panel work was started.',
    type: 'milestone',
  },
  {
    id: 'journal-6',
    title: 'Usage monitoring automation wired in',
    date: '2026-04-11',
    detail: 'Mission Control now has a working host-to-VPS usage snapshot flow, a dedicated Usage page, and a local Windows-run 10-minute refresh loop that pushes verified OpenAI/Codex and Anthropic status into the VPS database for remote monitoring.',
    type: 'ops',
  },
  {
    id: 'journal-7',
    title: 'Multi-model chat stabilized',
    date: '2026-04-11',
    detail: 'Chat moved from scaffolding to a working bottom-anchored messaging interface with live updates, Kimi K2.5 support, cleaned-up Claude options, and stronger model attribution so the selected model matches the actual backend route.',
    type: 'milestone',
  },
  {
    id: 'journal-8',
    title: 'GPT OAuth deferred for VPS chat path',
    date: '2026-04-11',
    detail: 'Direct GPT-via-OAuth from the public VPS was deferred because the local OpenClaw OAuth runtime is not internet-routable without extra tunneling. GPT options were removed from the VPS chat dropdown until a safer routing method is introduced later.',
    type: 'decision',
  },
  {
    id: 'journal-9',
    title: 'Formal completion roadmap defined',
    date: '2026-04-11',
    detail: 'The remaining path to a complete Mission Control VPS app is now formalized into Milestones C through H: stabilization and reliability, task execution engine, chat-to-task integration, memory and continuity, operations and resilience, and final polish/completion verification.',
    type: 'decision',
  },
  {
    id: 'journal-10',
    title: 'Milestone C — Stabilization complete',
    date: '2026-04-11',
    detail: 'Usage monitoring now shows staleness indicators (fresh/aging/stale). Chat page subtitle corrected, timeout and error handling added to all model calls. Current Tasks CRUD/drag/edit confirmed stable.',
    type: 'milestone',
  },
  {
    id: 'journal-11',
    title: 'Milestone D — Task execution engine built',
    date: '2026-04-11',
    detail: 'Tasks can now be executed by the assigned AI model directly from the Current Tasks board. Run Task button triggers the model, stores the execution result in task_executions, and auto-progresses task status from backlog to in-progress (on run) and to review (on completion). Execution output is viewable inline on the task card.',
    type: 'milestone',
  },
  {
    id: 'journal-12',
    title: 'Milestone E — Chat-to-task integration complete',
    date: '2026-04-11',
    detail: 'Chat is now a real control surface for Mission Control. Users can type "list tasks", "create task: title", "run task name", "move task X to done", or "show task X" directly in chat. Task commands execute instantly without an LLM call. The AI system prompt now includes live task context so normal conversation is task-aware. Chat thread renders formatted task output with bold text, bullet points, and status groupings.',
    type: 'milestone',
  },
  {
    id: 'journal-13',
    title: 'Milestone F — Memory and continuity complete',
    date: '2026-04-12',
    detail: 'Mission Control now has a DB-backed journal and curated memory system. Journal entries are created automatically when tasks execute, complete, or are created from chat. Memory notes can be pinned and are injected into every AI conversation. Chat commands: "add journal: title", "show journal", "remember key = value", "show memory", "forget key". Hardcoded journal entries are seeded into the DB on first visit.',
    type: 'milestone',
  },
  {
    id: 'journal-14',
    title: 'Milestone G — Operations and resilience complete',
    date: '2026-04-12',
    detail: 'Mission Control now has automated backup scripts (nightly Postgres dump with 7-day rolling retention), a database restore script, a system health dashboard (DB connectivity, latency, record counts, backup status, app uptime), a health check API endpoint, and admin maintenance actions (clear chat, purge old executions, vacuum DB). The Systems page is now a live operational dashboard.',
    type: 'milestone',
  },
  {
    id: 'journal-15',
    title: 'Milestone H — Final polish and completion verification',
    date: '2026-04-12',
    detail: 'Completed final UX and consistency pass. Fixed Usage page sidebar highlight. Home page now shows DB-backed journal count and active task count. Live Snapshot shows real active tasks instead of static AI build data. Team page updated to reflect actual model roster (GPT deferred). Tools and Automations pages updated to reflect real capabilities. All milestones A through H complete.',
    type: 'milestone',
  },
];

export const recentActivity = [
  'All milestones complete — Mission Control VPS v1 is finished',
  'Final polish pass — Home page shows live task/journal counts from DB',
  'System health dashboard live — DB status, backup visibility, app uptime',
  'Memory and journal system live — DB-backed with auto-journaling and AI context',
  'Chat is a full control surface — tasks, journal, memory all from conversation',
];
