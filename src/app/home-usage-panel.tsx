'use client';

import { useEffect, useState } from 'react';

interface UsageSnapshot {
  openai: {
    windowLeft: string;
    resetIn: string;
    weeklyLeft: string;
    weeklyResetIn: string;
    source: string;
  };
  claude: {
    status: string;
    note: string;
    source: string;
  };
}

function parseSourceTimestamp(source: string): Date | null {
  // source format: "host-snapshot @ 2026-04-11T12:34:56.000Z"
  const match = source.match(/@\s*(.+)$/);
  if (!match) return null;
  const d = new Date(match[1]);
  return isNaN(d.getTime()) ? null : d;
}

function getStalenessLabel(source: string): { label: string; stale: boolean } {
  const ts = parseSourceTimestamp(source);
  if (!ts) return { label: '', stale: false };
  const ageMinutes = Math.floor((Date.now() - ts.getTime()) / 60000);
  if (ageMinutes < 15) return { label: `${ageMinutes}m ago`, stale: false };
  if (ageMinutes < 60) return { label: `${ageMinutes}m ago`, stale: true };
  const ageHours = Math.floor(ageMinutes / 60);
  if (ageHours < 24) return { label: `${ageHours}h ago`, stale: true };
  return { label: `${Math.floor(ageHours / 24)}d ago`, stale: true };
}

export function HomeUsagePanel({ initialUsage }: { initialUsage: UsageSnapshot }) {
  const [usage, setUsage] = useState(initialUsage);
  const [refreshError, setRefreshError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function refresh() {
      try {
        const response = await fetch('/api/usage', { cache: 'no-store' });
        if (!response.ok) {
          if (!cancelled) setRefreshError(true);
          return;
        }
        const data = (await response.json()) as UsageSnapshot;
        if (!cancelled) {
          setUsage(data);
          setRefreshError(false);
        }
      } catch {
        if (!cancelled) setRefreshError(true);
      }
    }

    refresh();
    const interval = setInterval(refresh, 60000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const openaiAge = getStalenessLabel(usage.openai.source);
  const claudeAge = getStalenessLabel(usage.claude.source);

  return (
    <section className="usage-row">
      <div className={`usage-card accent-blue${openaiAge.stale ? ' usage-stale' : ''}`}>
        <span>OpenAI window left</span>
        <strong>{usage.openai.windowLeft}</strong>
        <p>Resets in {usage.openai.resetIn}</p>
        <p className="micro-copy">
          {openaiAge.label ? <span className={openaiAge.stale ? 'stale-badge' : 'fresh-badge'}>{openaiAge.label}</span> : null}
          {' '}Source: {usage.openai.source}
        </p>
      </div>
      <div className={`usage-card accent-blue-light${openaiAge.stale ? ' usage-stale' : ''}`}>
        <span>OpenAI weekly left</span>
        <strong>{usage.openai.weeklyLeft}</strong>
        <p>Resets in {usage.openai.weeklyResetIn}</p>
        <p className="micro-copy">
          {openaiAge.label ? <span className={openaiAge.stale ? 'stale-badge' : 'fresh-badge'}>{openaiAge.label}</span> : null}
          {' '}Source: {usage.openai.source}
        </p>
      </div>
      <div className={`usage-card accent-amber${claudeAge.stale ? ' usage-stale' : ''}`}>
        <span>Claude status</span>
        <strong>{usage.claude.status}</strong>
        <p>{usage.claude.note}</p>
        <p className="micro-copy">
          {claudeAge.label ? <span className={claudeAge.stale ? 'stale-badge' : 'fresh-badge'}>{claudeAge.label}</span> : null}
          {' '}Source: {usage.claude.source}
        </p>
      </div>
      {refreshError && (
        <div className="usage-card usage-error-card">
          <span>Refresh error</span>
          <p className="micro-copy">Usage API unreachable. Showing last known data.</p>
        </div>
      )}
    </section>
  );
}
