import 'server-only';

import { getDb } from '@/lib/db';
import { createTask, type TaskRecord } from '@/lib/tasks';
import { executeTask } from '@/lib/task-execution';

export interface AutomationRecord {
  id: string;
  title: string;
  description: string | null;
  cronSchedule: string;
  modelId: string;
  status: 'active' | 'paused' | 'archived';
  lastRun: string | null;
  nextRun: string | null;
  createdAt: string;
}

export interface AutomationRunRecord {
  id: string;
  automationId: string;
  taskId: string | null;
  status: 'pending' | 'completed' | 'failed';
  output: string | null;
  error: string | null;
  startedAt: string;
  completedAt: string | null;
}

interface AutomationRow {
  id: string; title: string; description: string | null; cron_schedule: string;
  model_id: string; status: 'active' | 'paused' | 'archived';
  last_run: Date | null; next_run: Date | null; created_at: Date;
}

interface RunRow {
  id: string; automation_id: string; task_id: string | null;
  status: 'pending' | 'completed' | 'failed'; output: string | null; error: string | null;
  started_at: Date; completed_at: Date | null;
}

function mapAutomation(r: AutomationRow): AutomationRecord {
  return {
    id: r.id, title: r.title, description: r.description, cronSchedule: r.cron_schedule,
    modelId: r.model_id, status: r.status, lastRun: r.last_run?.toISOString() ?? null,
    nextRun: r.next_run?.toISOString() ?? null, createdAt: r.created_at.toISOString(),
  };
}

function mapRun(r: RunRow): AutomationRunRecord {
  return {
    id: r.id, automationId: r.automation_id, taskId: r.task_id,
    status: r.status, output: r.output, error: r.error,
    startedAt: r.started_at.toISOString(), completedAt: r.completed_at?.toISOString() ?? null,
  };
}

// ── Simple cron parser (minute hour dom month dow) ──

interface CronParts { minute: string; hour: string; dom: string; month: string; dow: string; }

function parseCron(expr: string): CronParts | null {
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5) return null;
  return { minute: parts[0], hour: parts[1], dom: parts[2], month: parts[3], dow: parts[4] };
}

function matchesCronField(field: string, value: number): boolean {
  if (field === '*') return true;
  if (field.includes(',')) return field.split(',').some(f => matchesCronField(f, value));
  if (field.includes('/')) {
    const [, step] = field.split('/');
    return value % parseInt(step, 10) === 0;
  }
  return parseInt(field, 10) === value;
}

function matchesCron(expr: string, date: Date): boolean {
  const parts = parseCron(expr);
  if (!parts) return false;
  return (
    matchesCronField(parts.minute, date.getMinutes()) &&
    matchesCronField(parts.hour, date.getHours()) &&
    matchesCronField(parts.dom, date.getDate()) &&
    matchesCronField(parts.month, date.getMonth() + 1) &&
    matchesCronField(parts.dow, date.getDay())
  );
}

/** Calculate next run time from now for a cron expression */
export function getNextRunTime(cronExpr: string, from: Date = new Date()): Date | null {
  const parts = parseCron(cronExpr);
  if (!parts) return null;
  const check = new Date(from);
  check.setSeconds(0, 0);
  check.setMinutes(check.getMinutes() + 1);
  // Search up to 7 days ahead
  for (let i = 0; i < 7 * 24 * 60; i++) {
    if (matchesCron(cronExpr, check)) return check;
    check.setMinutes(check.getMinutes() + 1);
  }
  return null;
}

/** Get next N run times for preview */
export function getNextRunTimes(cronExpr: string, count: number): Date[] {
  const times: Date[] = [];
  let from = new Date();
  for (let i = 0; i < count; i++) {
    const next = getNextRunTime(cronExpr, from);
    if (!next) break;
    times.push(next);
    from = next;
  }
  return times;
}

/** Human-readable cron description */
export function describeCron(expr: string): string {
  const parts = parseCron(expr);
  if (!parts) return 'Invalid schedule';
  const { minute, hour, dom, month, dow } = parts;
  if (dom === '*' && month === '*' && dow === '*') return `Daily at ${hour}:${minute.padStart(2, '0')}`;
  if (dom === '*' && month === '*' && dow !== '*') {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return `${days[parseInt(dow)] || dow} at ${hour}:${minute.padStart(2, '0')}`;
  }
  return expr;
}

// ── CRUD ──

export async function listAutomations(): Promise<AutomationRecord[]> {
  const sql = getDb();
  const rows = await sql<AutomationRow[]>`
    SELECT * FROM mission_control.automations WHERE status != 'archived' ORDER BY created_at DESC
  `;
  return rows.map(mapAutomation);
}

export async function getAutomation(id: string): Promise<AutomationRecord | null> {
  const sql = getDb();
  const [row] = await sql<AutomationRow[]>`SELECT * FROM mission_control.automations WHERE id = ${id}`;
  return row ? mapAutomation(row) : null;
}

export async function createAutomation(input: {
  title: string; description?: string; cronSchedule: string; modelId: string;
}): Promise<AutomationRecord> {
  const sql = getDb();
  const nextRun = getNextRunTime(input.cronSchedule);
  const [row] = await sql<AutomationRow[]>`
    INSERT INTO mission_control.automations (title, description, cron_schedule, model_id, next_run)
    VALUES (${input.title}, ${input.description ?? null}, ${input.cronSchedule}, ${input.modelId}, ${nextRun})
    RETURNING *
  `;
  return mapAutomation(row);
}

export async function updateAutomationStatus(id: string, status: 'active' | 'paused' | 'archived'): Promise<void> {
  const sql = getDb();
  await sql`UPDATE mission_control.automations SET status = ${status} WHERE id = ${id}`;
}

export async function deleteAutomation(id: string): Promise<void> {
  const sql = getDb();
  await sql`DELETE FROM mission_control.automations WHERE id = ${id}`;
}

export async function listAutomationRuns(automationId: string, limit = 20): Promise<AutomationRunRecord[]> {
  const sql = getDb();
  const rows = await sql<RunRow[]>`
    SELECT * FROM mission_control.automation_runs
    WHERE automation_id = ${automationId}
    ORDER BY started_at DESC LIMIT ${limit}
  `;
  return rows.map(mapRun);
}

// ── Scheduler tick: find due automations and execute ──

export async function tickAutomations(): Promise<{ executed: number; errors: string[] }> {
  const sql = getDb();
  const errors: string[] = [];
  let executed = 0;

  const dueRows = await sql<AutomationRow[]>`
    SELECT * FROM mission_control.automations
    WHERE status = 'active' AND next_run IS NOT NULL AND next_run <= NOW()
  `;

  for (const row of dueRows) {
    const automation = mapAutomation(row);
    try {
      // Create auto-generated task
      const task = await createTask({
        title: `[Auto] ${automation.title}`,
        description: automation.description || automation.title,
        status: 'backlog',
        priority: 'medium',
        assignedAi: automation.modelId,
        notes: `Auto-generated by automation: ${automation.title}`,
      });

      // Record the run
      const [run] = await sql<RunRow[]>`
        INSERT INTO mission_control.automation_runs (automation_id, task_id)
        VALUES (${automation.id}, ${task.id})
        RETURNING *
      `;

      // Execute the task
      try {
        const result = await executeTask(task);
        await sql`
          UPDATE mission_control.automation_runs
          SET status = 'completed', output = ${result.result?.substring(0, 2000) ?? ''}, completed_at = NOW()
          WHERE id = ${run.id}
        `;
      } catch (execErr) {
        const msg = execErr instanceof Error ? execErr.message : 'Execution failed';
        await sql`
          UPDATE mission_control.automation_runs
          SET status = 'failed', error = ${msg}, completed_at = NOW()
          WHERE id = ${run.id}
        `;
        errors.push(`${automation.title}: ${msg}`);
      }

      // Update last_run and next_run
      const nextRun = getNextRunTime(automation.cronSchedule);
      await sql`
        UPDATE mission_control.automations
        SET last_run = NOW(), next_run = ${nextRun}
        WHERE id = ${automation.id}
      `;

      executed++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      errors.push(`${automation.title}: ${msg}`);
    }
  }

  return { executed, errors };
}
