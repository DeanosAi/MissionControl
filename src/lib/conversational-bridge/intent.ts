import type { ProjectRecord } from '@/lib/projects';
import type { ProjectClassification, RequestIntent } from '@/lib/conversational-bridge/types';

const BUILD_REQUEST = /\b(build|create|make|design|develop|launch|prototype|plan|scope|specify|draft|propose|turn\s+.+\s+into|help\s+me\s+(?:build|create|make|plan))\b/i;
const UPDATE_REQUEST = /\b(update|upgrade|improve|change|modify|customi[sz]e|extend|add|fix|redesign|refactor|continue|enhance)\b/i;
const REQUEST_START = /^(?:please\s+)?(?:(?:can|could|would)\s+you\s+)?(?:help\s+me\s+)?(?:build|create|make|design|develop|launch|prototype|update|improve|change|extend|add|fix|redesign|refactor|continue|enhance)\b/i;
const PLANNING_REQUEST_START = /^(?:please\s+)?(?:(?:can|could|would)\s+you\s+)?(?:help\s+me\s+)?(?:plan|scope|specify|draft|propose)(?:\s+(?:me|for\s+me))?\b/i;
const PRODUCT_WORK = /\b(feature|upgrade|project|app|application|website|site|system|workflow|automation|product|module|integration|interface|ui|user\s+experience|dashboard|theme|navigation|page|screen|mission\s+control)\b/i;
const EXPLICIT_TASK_COMMAND = /^(?:please\s+)?(?:(?:can|could|would)\s+you\s+)?(?:create|new|add)\s+(?:a\s+)?task(?:\s*:|\s+(?:called|named|to)\b)/i;
const STOP_WORDS = new Set([
  'a', 'an', 'and', 'app', 'application', 'build', 'create', 'for', 'help', 'i', 'in', 'make',
  'me', 'my', 'of', 'on', 'please', 'project', 'the', 'this', 'to', 'want', 'with',
]);

export function isConversationalBuildRequest(message: string): boolean {
  const trimmed = message.trim();
  if (trimmed.length < 8) return false;
  if (EXPLICIT_TASK_COMMAND.test(trimmed)) return false;
  if (/^(?:please\s+)?(?:(?:can|could|would)\s+you\s+)?add\s+up\b/i.test(trimmed)) return false;
  return REQUEST_START.test(trimmed)
    || (PLANNING_REQUEST_START.test(trimmed) && PRODUCT_WORK.test(trimmed))
    || /^i\s+(?:want|need)\s+(?:an?|to\s+(?:build|create|make|design|improve|update))\b/i.test(trimmed)
    || /^turn\s+.+\s+into\b/i.test(trimmed);
}

function toTitleCase(value: string): string {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.length > 3 ? `${word[0].toUpperCase()}${word.slice(1)}` : word)
    .join(' ');
}

export function deriveRequestIntent(message: string): RequestIntent {
  const trimmed = message.trim().replace(/[.!?]+$/, '');
  let projectTitle = trimmed
    .replace(/^(?:please\s+)?(?:(?:can|could|would)\s+you\s+)?/i, '')
    .replace(/^(?:help\s+me\s+)?(?:build|create|make|design|develop|launch|prototype|plan|scope|specify|draft|propose|update|upgrade|improve|change|modify|customi[sz]e|extend|add|fix|redesign|refactor|continue|enhance)\s+(?:(?:for\s+)?me\s+)?(?:an?\s+)?/i, '')
    .replace(/^i\s+want\s+(?:an?\s+|to\s+(?:build|create|make)\s+(?:an?\s+)?)?/i, '')
    .replace(/\s+(?:for me|please)$/i, '')
    .trim();

  if (!projectTitle) projectTitle = 'Untitled Project';
  if (projectTitle.length > 80) projectTitle = projectTitle.slice(0, 80).trim();

  const category: RequestIntent['category'] = /\bautomat(e|ion)|schedule|recurring\b/i.test(trimmed)
    ? 'automate'
    : /\bresearch|investigate|compare|analyse|analyze\b/i.test(trimmed)
      ? 'research'
      : UPDATE_REQUEST.test(trimmed)
        ? 'improve'
        : BUILD_REQUEST.test(trimmed)
          ? 'build'
          : 'other';

  const title = toTitleCase(projectTitle);
  return {
    category,
    projectTitle: title || 'Untitled Project',
    normalizedIntent: `${category === 'improve' ? 'Improve' : category === 'automate' ? 'Automate' : category === 'research' ? 'Research' : 'Build'} ${title || 'the requested product'} through an approval-first Mission Control proposal.`,
  };
}

function tokens(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/[\s-]+/)
    .filter((token) => token.length > 1 && !STOP_WORDS.has(token));
}

function matchScore(message: string, project: ProjectRecord): number {
  const lowerMessage = message.toLowerCase();
  if (lowerMessage.includes(project.title.toLowerCase())) return 1;

  const requestTokens = new Set(tokens(message));
  const projectTokens = new Set(tokens(`${project.title} ${project.summary}`));
  if (requestTokens.size === 0 || projectTokens.size === 0) return 0;

  let overlap = 0;
  for (const token of requestTokens) {
    if (projectTokens.has(token)) overlap += 1;
  }
  return overlap / Math.min(requestTokens.size, projectTokens.size);
}

export interface ProjectMatch {
  classification: ProjectClassification;
  matchedProject: ProjectRecord | null;
  rationale: string;
}

export function classifyProjectRequest(message: string, projects: ProjectRecord[]): ProjectMatch {
  const candidates = projects
    .filter((project) => project.status !== 'archived')
    .map((project) => ({ project, score: matchScore(message, project) }))
    .sort((a, b) => b.score - a.score);

  const best = candidates[0];
  if (!best || best.score < 0.42) {
    return {
      classification: 'new-project',
      matchedProject: null,
      rationale: 'No existing project has enough context overlap, so this request starts a new project.',
    };
  }

  if (UPDATE_REQUEST.test(message) && best.score >= 0.55) {
    return {
      classification: 'existing-project',
      matchedProject: best.project,
      rationale: `The request explicitly changes the existing ${best.project.title} project.`,
    };
  }

  return {
    classification: 'child-project',
    matchedProject: best.project,
    rationale: `The request is a distinct deliverable that belongs under ${best.project.title}.`,
  };
}
