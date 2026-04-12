import 'server-only';

import { getDb } from '@/lib/db';

export interface SystemHealthReport {
  database: {
    connected: boolean;
    latencyMs: number | null;
    error: string | null;
    tableCount: number | null;
    taskCount: number | null;
    journalCount: number | null;
    memoryCount: number | null;
    chatMessageCount: number | null;
    executionCount: number | null;
  };
  backup: {
    status: string;
    lastBackup: string | null;
    sizeMb: string | null;
    retainedBackups: number | null;
    retentionDays: number | null;
    error: string | null;
  };
  app: {
    uptime: string;
    nodeEnv: string;
    startedAt: string;
  };
  checkedAt: string;
}

const APP_START_TIME = new Date();

/** Check database connectivity and gather stats */
async function checkDatabase(): Promise<SystemHealthReport['database']> {
  try {
    const sql = getDb();
    const start = Date.now();
    await sql`SELECT 1`;
    const latencyMs = Date.now() - start;

    // Gather table counts
    const [stats] = await sql<{
      task_count: string;
      journal_count: string;
      memory_count: string;
      chat_count: string;
      execution_count: string;
    }[]>`
      SELECT
        (SELECT COUNT(*)::text FROM mission_control.tasks) as task_count,
        (SELECT COUNT(*)::text FROM mission_control.journal_entries) as journal_count,
        (SELECT COUNT(*)::text FROM mission_control.memory_notes) as memory_count,
        (SELECT COUNT(*)::text FROM mission_control.chat_messages) as chat_count,
        (SELECT COUNT(*)::text FROM mission_control.task_executions) as execution_count
    `;

    return {
      connected: true,
      latencyMs,
      error: null,
      tableCount: 6,
      taskCount: parseInt(stats.task_count, 10),
      journalCount: parseInt(stats.journal_count, 10),
      memoryCount: parseInt(stats.memory_count, 10),
      chatMessageCount: parseInt(stats.chat_count, 10),
      executionCount: parseInt(stats.execution_count, 10),
    };
  } catch (err) {
    return {
      connected: false,
      latencyMs: null,
      error: err instanceof Error ? err.message : 'Unknown DB error',
      tableCount: null,
      taskCount: null,
      journalCount: null,
      memoryCount: null,
      chatMessageCount: null,
      executionCount: null,
    };
  }
}

/** Read backup status from the JSON file written by backup-database.sh */
async function checkBackupStatus(): Promise<SystemHealthReport['backup']> {
  try {
    const fs = await import('fs/promises');
    const backupStatusPath = process.env.BACKUP_STATUS_PATH || '/home/dean/backups/mission-control/backup-status.json';
    const data = await fs.readFile(backupStatusPath, 'utf-8');
    const status = JSON.parse(data);
    return {
      status: status.status || 'unknown',
      lastBackup: status.lastBackup || null,
      sizeMb: status.sizeMb || null,
      retainedBackups: status.retainedBackups ?? null,
      retentionDays: status.retentionDays ?? null,
      error: status.error || null,
    };
  } catch {
    return {
      status: 'unknown',
      lastBackup: null,
      sizeMb: null,
      retainedBackups: null,
      retentionDays: null,
      error: 'Backup status file not found. Run backup-database.sh first or set BACKUP_STATUS_PATH.',
    };
  }
}

/** Format uptime duration */
function formatUptime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ${hours % 24}h ${minutes % 60}m`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

/** Get full system health report */
export async function getSystemHealth(): Promise<SystemHealthReport> {
  const [database, backup] = await Promise.all([
    checkDatabase(),
    checkBackupStatus(),
  ]);

  const uptimeMs = Date.now() - APP_START_TIME.getTime();

  return {
    database,
    backup,
    app: {
      uptime: formatUptime(uptimeMs),
      nodeEnv: process.env.NODE_ENV || 'development',
      startedAt: APP_START_TIME.toISOString(),
    },
    checkedAt: new Date().toISOString(),
  };
}
