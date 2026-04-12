'use client';

import { useEffect, useState } from 'react';

interface SystemHealth {
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

function StatusDot({ ok }: { ok: boolean }) {
  return (
    <span
      className={`status-dot ${ok ? 'status-ok' : 'status-error'}`}
      title={ok ? 'Healthy' : 'Issue detected'}
    />
  );
}

export function SystemHealthPanel({ initialHealth }: { initialHealth: SystemHealth }) {
  const [health, setHealth] = useState(initialHealth);
  const [refreshing, setRefreshing] = useState(false);
  const [gptStatus, setGptStatus] = useState<{ available: boolean; error: string | null } | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function refresh() {
      try {
        const [healthRes, gptRes] = await Promise.all([
          fetch('/api/health', { cache: 'no-store' }),
          fetch('/api/gpt-status', { cache: 'no-store' }),
        ]);
        if (!cancelled) {
          if (healthRes.ok) setHealth(await healthRes.json());
          if (gptRes.ok) setGptStatus(await gptRes.json());
        }
      } catch { /* keep last data */ }
    }

    const interval = setInterval(refresh, 30000); // refresh every 30s
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  async function manualRefresh() {
    setRefreshing(true);
    try {
      const [healthRes, gptRes] = await Promise.all([
        fetch('/api/health', { cache: 'no-store' }),
        fetch('/api/gpt-status', { cache: 'no-store' }),
      ]);
      if (healthRes.ok) setHealth(await healthRes.json());
      if (gptRes.ok) setGptStatus(await gptRes.json());
    } catch { /* keep last */ }
    setRefreshing(false);
  }

  const db = health.database;
  const bk = health.backup;
  const app = health.app;
  const backupOk = bk.status === 'success';
  const gptOk = gptStatus?.available ?? false;
  const lastCheck = health.checkedAt ? new Date(health.checkedAt).toLocaleTimeString() : 'unknown';

  return (
    <section className="card page-systems-accent">
      <div className="task-board-section-header">
        <div>
          <div className="eyebrow">System Health</div>
          <h2>Operational Status</h2>
        </div>
        <div className="health-header-actions">
          <span className="micro-copy">Last check: {lastCheck}</span>
          <button
            type="button"
            className="move-task-button"
            disabled={refreshing}
            onClick={manualRefresh}
          >
            {refreshing ? 'Checking...' : 'Refresh'}
          </button>
        </div>
      </div>

      <div className="health-grid">
        {/* Database */}
        <div className={`health-card ${db.connected ? 'health-ok' : 'health-error'}`}>
          <div className="health-card-header">
            <StatusDot ok={db.connected} />
            <h3>Database</h3>
          </div>
          {db.connected ? (
            <>
              <p className="health-stat"><span>Latency</span><strong>{db.latencyMs}ms</strong></p>
              <p className="health-stat"><span>Tasks</span><strong>{db.taskCount}</strong></p>
              <p className="health-stat"><span>Journal entries</span><strong>{db.journalCount}</strong></p>
              <p className="health-stat"><span>Memory notes</span><strong>{db.memoryCount}</strong></p>
              <p className="health-stat"><span>Chat messages</span><strong>{db.chatMessageCount}</strong></p>
              <p className="health-stat"><span>Executions</span><strong>{db.executionCount}</strong></p>
            </>
          ) : (
            <p className="health-error-text">{db.error}</p>
          )}
        </div>

        {/* Backup */}
        <div className={`health-card ${backupOk ? 'health-ok' : bk.status === 'unknown' ? 'health-warn' : 'health-error'}`}>
          <div className="health-card-header">
            <StatusDot ok={backupOk} />
            <h3>Backups</h3>
          </div>
          {bk.lastBackup ? (
            <>
              <p className="health-stat"><span>Last backup</span><strong>{bk.lastBackup}</strong></p>
              <p className="health-stat"><span>Size</span><strong>{bk.sizeMb} MB</strong></p>
              <p className="health-stat"><span>Retained</span><strong>{bk.retainedBackups} backups</strong></p>
              <p className="health-stat"><span>Retention</span><strong>{bk.retentionDays} days</strong></p>
            </>
          ) : (
            <p className="health-error-text">{bk.error || 'No backup data available. Run backup-database.sh to start.'}</p>
          )}
        </div>

        {/* App */}
        <div className="health-card health-ok">
          <div className="health-card-header">
            <StatusDot ok={true} />
            <h3>Application</h3>
          </div>
          <p className="health-stat"><span>Uptime</span><strong>{app.uptime}</strong></p>
          <p className="health-stat"><span>Environment</span><strong>{app.nodeEnv}</strong></p>
          <p className="health-stat"><span>Started</span><strong>{new Date(app.startedAt).toLocaleString()}</strong></p>
        </div>

        {/* GPT OAuth */}
        <div className={`health-card ${gptOk ? 'health-ok' : 'health-warn'}`}>
          <div className="health-card-header">
            <StatusDot ok={gptOk} />
            <h3>GPT OAuth</h3>
          </div>
          <p className="health-stat">
            <span>Status</span>
            <strong>{gptOk ? 'Online' : 'Offline'}</strong>
          </p>
          <p className="health-stat">
            <span>Tunnel</span>
            <strong>{gptOk ? 'Connected' : 'Not connected'}</strong>
          </p>
          {!gptOk && (
            <p className="health-error-text">
              {gptStatus?.error || 'Host PC offline or tunnel not running. GPT will fall back to Kimi K2.5.'}
            </p>
          )}
          {gptOk && (
            <p className="health-stat">
              <span>Fallback</span>
              <strong>Kimi K2.5 (when offline)</strong>
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
