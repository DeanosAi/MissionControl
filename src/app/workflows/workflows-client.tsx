'use client';

import { useCallback, useEffect, useState } from 'react';

interface Workflow { id: string; name: string; active: boolean; }
interface WorkflowRun { id: string; workflowId: string; workflowName: string | null; status: string; error: string | null; startedAt: string; completedAt: string | null; }

export function WorkflowsClient() {
  const [connected, setConnected] = useState<boolean | null>(null);
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [runs, setRuns] = useState<WorkflowRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [runningId, setRunningId] = useState<string | null>(null);

  const checkConnection = useCallback(async () => {
    const res = await fetch('/api/n8n/workflows?test=1');
    if (res.ok) {
      const data = await res.json();
      setConnected(data.connected);
      if (data.connected) {
        const wRes = await fetch('/api/n8n/workflows');
        if (wRes.ok) setWorkflows(await wRes.json());
        const rRes = await fetch('/api/n8n/workflows?runs=1');
        if (rRes.ok) setRuns(await rRes.json());
      }
    }
    setLoading(false);
  }, []);

  useEffect(() => { checkConnection(); }, [checkConnection]);

  async function executeWorkflow(wf: Workflow) {
    setRunningId(wf.id);
    await fetch('/api/n8n/workflows', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workflowId: wf.id, workflowName: wf.name }),
    });
    setRunningId(null);
    checkConnection(); // refresh runs
  }

  if (loading) return <section className="card"><p className="micro-copy">Checking N8N connection...</p></section>;

  if (!connected) {
    return (
      <section className="card page-automations-accent">
        <div className="task-board-section-header">
          <div><div className="eyebrow">N8N</div><h2>Setup Required</h2></div>
        </div>
        <p>N8N is not detected. To enable workflow automation:</p>
        <div className="task-execution-output" style={{ marginTop: '0.75rem' }}>
          <pre className="exec-output-body">{`# Install N8N via Docker:
docker run -d --name n8n \\
  -p 5678:5678 \\
  -v n8n_data:/home/node/.n8n \\
  n8nio/n8n

# Then set in your .env:
N8N_API_URL=http://localhost:5678
N8N_API_KEY=your-api-key`}</pre>
        </div>
        <button className="move-task-button" style={{ marginTop: '1rem' }} onClick={checkConnection}>Recheck Connection</button>
      </section>
    );
  }

  return (
    <>
      <section className="card page-automations-accent">
        <div className="task-board-section-header">
          <div><div className="eyebrow">N8N</div><h2>Available Workflows ({workflows.length})</h2></div>
          <span className="pill">Connected</span>
        </div>
        {workflows.length === 0 ? <p className="micro-copy">No workflows found in N8N. Create one in the N8N editor.</p> : (
          <div className="stack">
            {workflows.map(wf => (
              <div key={wf.id} className="kanban-card">
                <div className="pill-row left">
                  <span className={`pill ${wf.active ? '' : 'ghost'}`}>{wf.active ? 'Active' : 'Inactive'}</span>
                </div>
                <h4>{wf.name}</h4>
                <div className="task-execution-controls">
                  <button className="run-task-button" disabled={runningId === wf.id} onClick={() => executeWorkflow(wf)}>
                    {runningId === wf.id ? '⟳ Running...' : '▶ Run Workflow'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {runs.length > 0 && (
        <section className="card">
          <div className="task-board-section-header">
            <div><div className="eyebrow">History</div><h2>Recent Runs</h2></div>
          </div>
          <div className="stack">
            {runs.slice(0, 10).map(r => (
              <div key={r.id} className="journal-row">
                <div>
                  <div className="pill-row left">
                    <span className={`pill ${r.status === 'completed' ? '' : 'ghost'}`}>{r.status}</span>
                    <span className="micro-copy">{r.workflowName || r.workflowId}</span>
                  </div>
                  <p className="micro-copy">{new Date(r.startedAt).toLocaleString()}</p>
                  {r.error && <p style={{ color: 'var(--pink)', fontSize: '0.82rem' }}>{r.error}</p>}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
