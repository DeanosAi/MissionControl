export type ChatTaskStatus = 'backlog' | 'in-progress' | 'review' | 'done' | 'archived';
export type TaskCommandType = 'create' | 'list' | 'run' | 'status' | 'show';

export interface TaskCommand {
  type: TaskCommandType;
  title?: string;
  description?: string;
  priority?: 'low' | 'medium' | 'high';
  assignedAi?: string;
  taskRef?: string;
  newStatus?: ChatTaskStatus;
}

const POLITE_PREFIX = String.raw`(?:please\s+)?(?:(?:can|could|would)\s+you\s+)?`;
const STATUS_PATTERN = String.raw`backlog|to[\s-]?do|in[\s-]?progress|started|working|review|reviewing|done|complete|completed|finished|archived|archive`;

function cleanCapturedValue(value: string): string {
  return value
    .trim()
    .replace(/^["“”']+|["“”']+$/g, '')
    .replace(/[.!?]+$/, '')
    .trim();
}

export function parseTaskStatus(value: string): ChatTaskStatus | null {
  const normalized = value.toLowerCase().trim().replace(/-/g, ' ').replace(/\s+/g, ' ');
  const aliases: Record<string, ChatTaskStatus> = {
    backlog: 'backlog',
    'to do': 'backlog',
    todo: 'backlog',
    'in progress': 'in-progress',
    started: 'in-progress',
    working: 'in-progress',
    review: 'review',
    reviewing: 'review',
    done: 'done',
    complete: 'done',
    completed: 'done',
    finished: 'done',
    archived: 'archived',
    archive: 'archived',
  };
  return aliases[normalized] ?? null;
}

/**
 * Parse only explicit task commands.
 *
 * Deliberately requiring either punctuation ("create task: …") or a command
 * delimiter ("called", "named", or "to") prevents product requests such as
 * "create a task management app" from bypassing the Decision Engine.
 */
export function detectTaskIntent(message: string): TaskCommand | null {
  const trimmed = message.trim();
  if (!trimmed) return null;

  const createPatterns = [
    new RegExp(`^${POLITE_PREFIX}(?:create|new|add)\\s+(?:a\\s+)?task\\s*:\\s*(.+)$`, 'i'),
    new RegExp(`^${POLITE_PREFIX}(?:create|new|add)\\s+(?:a\\s+)?task\\s+(?:called|named)\\s+(.+)$`, 'i'),
    new RegExp(`^${POLITE_PREFIX}(?:create|new|add)\\s+(?:a\\s+)?task\\s+to\\s+(.+)$`, 'i'),
  ];
  for (const pattern of createPatterns) {
    const match = trimmed.match(pattern);
    const title = match?.[1] ? cleanCapturedValue(match[1]) : '';
    if (title) return { type: 'create', title };
  }

  const listPattern = new RegExp(
    `^${POLITE_PREFIX}(?:(?:list|show|get|view)\\s+(?:all\\s+)?(?:(?:my|current)\\s+)?tasks|(?:my\\s+|current\\s+)?tasks)\\s*[?.!]*$`,
    'i',
  );
  if (listPattern.test(trimmed)) return { type: 'list' };

  const runPattern = new RegExp(
    `^${POLITE_PREFIX}(?:run|execute|start)\\s+(?:the\\s+)?task(?:\\s*:\\s*|\\s+)(.+)$`,
    'i',
  );
  const runMatch = trimmed.match(runPattern);
  if (runMatch?.[1]) {
    const taskRef = cleanCapturedValue(runMatch[1]);
    if (taskRef) return { type: 'run', taskRef };
  }

  const statusPattern = new RegExp(
    `^${POLITE_PREFIX}(?:move|set|change|update)\\s+(?:the\\s+)?task\\s+(.+?)\\s+(?:to|status\\s+to)\\s+(${STATUS_PATTERN})\\s*[?.!]*$`,
    'i',
  );
  const statusMatch = trimmed.match(statusPattern);
  if (statusMatch?.[1] && statusMatch[2]) {
    const taskRef = cleanCapturedValue(statusMatch[1]);
    const newStatus = parseTaskStatus(statusMatch[2]);
    if (taskRef && newStatus) return { type: 'status', taskRef, newStatus };
  }

  const showPattern = new RegExp(
    `^${POLITE_PREFIX}(?:(?:show|describe)\\s+(?:the\\s+)?task|details?\\s+(?:of|for)\\s+(?:the\\s+)?task|what(?:'s|\\s+is)\\s+(?:the\\s+)?status\\s+of\\s+(?:the\\s+)?task)(?:\\s*:\\s*|\\s+)(.+?)\\s*[?.!]*$`,
    'i',
  );
  const showMatch = trimmed.match(showPattern);
  if (showMatch?.[1]) {
    const taskRef = cleanCapturedValue(showMatch[1]);
    if (taskRef) return { type: 'show', taskRef };
  }

  return null;
}
