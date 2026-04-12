'use client';

import { useCallback, useEffect, useState } from 'react';

interface Automation {
  id: string; title: string; description: string | null; cronSchedule: string;
  modelId: string; status: string; lastRun: string | null; nextRun: string | null; createdAt: string;
}

interface AutomationRun {
  id: string; status: string; output: string | null; error: string | null; startedAt: string; completedAt: string | null;
}

interface Props {
  initialAutomations: Automation[];
}

const PRESETS = [
  { label: 'Daily at 9am', cron: '0 9 * * *' },
  { label: 'Daily at 6am', cron: '0 6 * * *' },
  { label: 'Daily at 9pm', cron: '0 21 * * *' },
  { label: 'Weekly on Monday 9am', cron: '0 9 * * 1' },
  { label: 'Weekly on Sunday 9am', cron: '0 9 * * 0' },
  { label: 'Monthly on 1st at 9am', cron: '0 9 1 * *' },
];

const TEMPLATES = [
  { title: 'Weekly Social Media Trends', description: 'Research latest TikTok and Instagram trends, rank them, save summary.', cron: '0 9 * * 0', model: 'kimi-k2.5' },
  { title: 'Daily Instagram View Count', description: 'Check view count for Instagram page, log the data.', cron: '0 21 * * *', model: 'kimi-k2.5' },
  { title: 'Morning Schedule & Tasks', description: 'Pull current tasks and create a morning summary.', cron: '0 6 * * *', model: 'kimi-k2.5' },
];

export function AutomationsClient({ initialAutomations }: Props) {
  const [automations, setAutomations] = useState<Automation[]>(initialAutomations);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [cronSchedule, setCronSchedule] = useState('0 9 * * *');
  const [modelId, setModelId] = useState('kimi-k2.5');
  const [preview, setPreview] = useState<{ description: string; nextRuns: string[] } | null>(null);
  const [creating, setCreating] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchAutomations = useCallback(async () => {
    const res = await fetch('/api/automations');
    if (res.ok) setAutomations(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => { fetchAutomations(); }, [fetchAutomations]);

  // Preview cron schedule
  useEffect(() => {
    if (!cronSchedule.trim()) { setPreview(null); return; }
    const timer = setTimeout(async () => {
      const res = await fetch(`/api/automations?preview=${encodeURIComponent(cronSchedule)}`);
      if (res.ok) setPreview(await res.json());
    }, 300);
    return () => clearTimeout(timer);
  }, [cronSchedule]);

  async function handleCreate() {
    if (!title.trim() || !cronSchedule.trim()) return;
    setCreating(true);
    await fetch('/api/automations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'create', title, description, cronSchedule, modelId }),
    });
    setTitle(''); setDescription(''); setCreating(false); setShowForm(false);
    fetchAutomations();
  }

  async function handleAction(id: string, action: string) {
    await fetch('/api/automations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, id }),
    });
    fetchAutomations();
  }

  function applyTemplate(t: typeof TEMPLATES[0]) {
    setTitle(t.title); setDescription(t.description); setCronSchedule(t.cron); setModelId(t.model); setShowForm(true);
  }

  return (
    <>
      {/* Templates */}
      <section className="card page-automations-accent">
        <div className="task-board-section-header">
          <div><div className="eyebrow">Quick Start</div><h2>Templates</h2></div>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          {TEMPLATES.map((t, i) => (
            <button key={i} className="kanban-card" style={{ cursor: 'pointer', textAlign: 'left', flex: '1 1 250px' }} onClick={() => applyTemplate(t)}>
              <h4>{t.title}</h4>
              <p className="micro-copy">{t.description}</p>
              <span className="pill ghost">{t.cron}</span>
            </button>
          ))}
        </div>
      </section>

      {/* Create Form */}
      <section className="card page-automations-accent">
        <div className="task-board-section-header">
          <div><div className="eyebrow">Create</div><h2>New Automation</h2></div>
        </div>
        <button className="move-task-button" style={{ marginBottom: '1rem' }} onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Hide Form' : '+ Create Automation'}
        </button>
        {showForm && (
          <>
            <div className="task-form-grid">
              <label className="login-field"><span>Title</span><input type="text" value={title} onChange={e => setTitle(e.target.value)} /></label>
              <label className="login-field"><span>Model</span>
                <select value={modelId} onChange={e => setModelId(e.target.value)}>
                  <option value="kimi-k2.5">Kimi K2.5</option>
                  <option value="claude-sonnet-4-5">Claude Sonnet 4.5</option>
                  <option value="claude-opus-4-6">Claude Opus 4.6</option>
                </select>
              </label>
              <label className="login-field task-field-full"><span>Description</span><textarea rows={2} value={description} onChange={e => setDescription(e.target.value)} /></label>
              <label className="login-field"><span>Cron Schedule</span><input type="text" value={cronSchedule} onChange={e => setCronSchedule(e.target.value)} placeholder="0 9 * * *" /></label>
              <label className="login-field"><span>Preset</span>
                <select onChange={e => { if (e.target.value) setCronSchedule(e.target.value); }}>
                  <option value="">Custom</option>
                  {PRESETS.map(p => <option key={p.cron} value={p.cron}>{p.label}</option>)}
                </select>
              </label>
            </div>
            {preview && (
              <div style={{ marginTop: '0.5rem' }}>
                <p className="micro-copy">Schedule: {preview.description}</p>
                <p className="micro-copy">Next runs: {preview.nextRuns.slice(0, 3).map(t => new Date(t).toLocaleString()).join(' · ')}</p>
              </div>
            )}
            <button className="login-button task-submit" disabled={creating || !title.trim()} onClick={handleCreate} style={{ marginTop: '0.75rem' }}>
              {creating ? 'Creating...' : 'Create Automation'}
            </button>
          </>
        )}
      </section>

      {/* Active Automations */}
      <section className="card">
        <div className="task-board-section-header">
          <div><div className="eyebrow">Active</div><h2>Automations ({automations.length})</h2></div>
        </div>
        {loading ? <p className="micro-copy">Loading...</p> : automations.length === 0 ? <p className="micro-copy">No automations yet.</p> : (
          <div className="stack">
            {automations.map(a => (
              <AutomationRow key={a.id} automation={a} expanded={expandedId === a.id} onToggle={() => setExpandedId(expandedId === a.id ? null : a.id)} onAction={handleAction} />
            ))}
          </div>
        )}
      </section>
    </>
  );
}

function AutomationRow({ automation: a, expanded, onToggle, onAction }: {
  automation: Automation; expanded: boolean; onToggle: () => void; onAction: (id: string, action: string) => void;
}) {
  const [runs, setRuns] = useState<AutomationRun[]>([]);

  useEffect(() => {
    if (expanded) {
      fetch(`/api/automations?runs_for=${a.id}`).then(r => r.ok ? r.json() : []).then(setRuns);
    }
  }, [expanded, a.id]);

  return (
    <div className="kanban-card">
      <div className="task-drag-header" style={{ cursor: 'pointer' }} onClick={onToggle}>
        <div className="pill-row left">
          <span className={`pill ${a.status === 'active' ? '' : 'ghost'}`}>{a.status}</span>
          <span className="pill ghost">{a.cronSchedule}</span>
          <span className="pill ghost">{a.modelId}</span>
        </div>
        <span style={{ fontSize: '1.2rem' }}>{expanded ? '▾' : '▸'}</span>
      </div>
      <h4>{a.title}</h4>
      {a.description && <p className="micro-copy">{a.description}</p>}
      <p className="micro-copy">
        {a.lastRun ? `Last: ${new Date(a.lastRun).toLocaleString()}` : 'Never run'}
        {a.nextRun ? ` · Next: ${new Date(a.nextRun).toLocaleString()}` : ''}
      </p>
      <div className="task-execution-controls">
        {a.status === 'active' ? (
          <button className="move-task-button" onClick={() => onAction(a.id, 'pause')}>Pause</button>
        ) : (
          <button className="move-task-button" onClick={() => onAction(a.id, 'resume')}>Resume</button>
        )}
        <button className="move-task-button delete-task-button" onClick={() => onAction(a.id, 'delete')}>Delete</button>
      </div>
      {expanded && runs.length > 0 && (
        <div style={{ marginTop: '0.75rem' }}>
          <p className="micro-copy" style={{ marginBottom: '0.35rem' }}>Recent runs:</p>
          {runs.slice(0, 5).map(r => (
            <div key={r.id} className="micro-copy" style={{ padding: '0.2rem 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
              <span className={`pill ${r.status === 'completed' ? '' : 'ghost'}`} style={{ fontSize: '0.7rem' }}>{r.status}</span>
              {' '}{new Date(r.startedAt).toLocaleString()}
              {r.error && <span style={{ color: 'var(--pink)' }}> — {r.error}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
