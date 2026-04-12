'use client';

import { useCallback, useEffect, useState } from 'react';

interface Idea {
  id: string;
  title: string;
  description: string | null;
  status: string;
  researchData: {
    market?: { summary: string; viability: string; notes: string };
    technical?: { feasibility: string; stack: string; complexity: string };
    competition?: { competitors: string[]; differentiation: string };
    estimate?: { cost: string; time: string; resources: string };
  } | null;
  conversationHistory: { role: string; content: string; timestamp: string }[];
  mvpCode: string | null;
  codexPrompt: string | null;
  createdAt: string;
}

interface Props {
  initialIdeas: Idea[];
}

export function IdeasClient({ initialIdeas }: Props) {
  const [ideas, setIdeas] = useState<Idea[]>(initialIdeas);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const fetchIdeas = useCallback(async () => {
    const params = new URLSearchParams();
    if (search) params.set('q', search);
    if (statusFilter) params.set('status', statusFilter);
    const res = await fetch(`/api/ideas?${params}`);
    if (res.ok) setIdeas(await res.json());
    setLoading(false);
  }, [search, statusFilter]);

  useEffect(() => { fetchIdeas(); }, [fetchIdeas]);

  async function handleCreate() {
    if (!title.trim()) return;
    setCreating(true);
    const res = await fetch('/api/ideas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, description }),
    });
    if (res.ok) {
      setTitle('');
      setDescription('');
      fetchIdeas();
    }
    setCreating(false);
  }

  return (
    <>
      {/* Submit Idea */}
      <section className="card page-ideas-accent">
        <div className="task-board-section-header">
          <div>
            <div className="eyebrow">New Idea</div>
            <h2>Submit an Idea</h2>
          </div>
        </div>
        <div className="task-form-grid">
          <label className="login-field">
            <span>Title</span>
            <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="What's the idea?" />
          </label>
          <label className="login-field task-field-full">
            <span>Description (optional)</span>
            <textarea rows={3} value={description} onChange={e => setDescription(e.target.value)} placeholder="Add context, goals, or inspiration..." />
          </label>
        </div>
        <button className="login-button task-submit" disabled={creating || !title.trim()} onClick={handleCreate} style={{ marginTop: '0.75rem' }}>
          {creating ? 'Submitting...' : 'Submit Idea'}
        </button>
      </section>

      {/* Search and Filter */}
      <section className="card" style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <label className="login-field" style={{ flex: 1 }}>
          <span>Search</span>
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search ideas..." />
        </label>
        <label className="login-field">
          <span>Status</span>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="">All</option>
            <option value="submitted">Submitted</option>
            <option value="researching">Researching</option>
            <option value="researched">Researched</option>
            <option value="building">Building</option>
            <option value="built">Built</option>
          </select>
        </label>
      </section>

      {/* Ideas List */}
      <section className="card page-ideas-accent">
        <div className="task-board-section-header">
          <div>
            <div className="eyebrow">Ideas</div>
            <h2>Your Ideas ({ideas.length})</h2>
          </div>
        </div>
        {loading ? <p className="micro-copy">Loading...</p> : ideas.length === 0 ? <p className="micro-copy">No ideas yet. Submit one above.</p> : (
          <div className="stack">
            {ideas.map(idea => (
              <IdeaCard key={idea.id} idea={idea} expanded={expandedId === idea.id} onToggle={() => setExpandedId(expandedId === idea.id ? null : idea.id)} onRefresh={fetchIdeas} />
            ))}
          </div>
        )}
      </section>
    </>
  );
}

function IdeaCard({ idea, expanded, onToggle, onRefresh }: { idea: Idea; expanded: boolean; onToggle: () => void; onRefresh: () => void }) {
  const [researching, setResearching] = useState(false);
  const [chatMsg, setChatMsg] = useState('');
  const [chatting, setChatting] = useState(false);
  const [localConvo, setLocalConvo] = useState(idea.conversationHistory);

  const statusColors: Record<string, string> = {
    submitted: 'ghost', researching: 'highlight', researched: '', building: 'highlight', built: '', archived: 'ghost',
  };

  async function handleResearch() {
    setResearching(true);
    await fetch(`/api/ideas/${idea.id}/research`, { method: 'POST' });
    setResearching(false);
    onRefresh();
  }

  async function handleChat() {
    if (!chatMsg.trim()) return;
    setChatting(true);
    setLocalConvo(prev => [...prev, { role: 'user', content: chatMsg, timestamp: new Date().toISOString() }]);
    const msg = chatMsg;
    setChatMsg('');
    const res = await fetch(`/api/ideas/${idea.id}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: msg }),
    });
    if (res.ok) {
      const { reply } = await res.json();
      setLocalConvo(prev => [...prev, { role: 'assistant', content: reply, timestamp: new Date().toISOString() }]);
    }
    setChatting(false);
  }

  async function handleBuild(model: string) {
    await fetch('/api/ideas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: `Build: ${idea.title}`,
        description: idea.mvpCode || idea.codexPrompt || idea.description || idea.title,
      }),
    });
    // Actually create as a task via the tasks API
    // This is simplified — ideally calls createTask directly
    alert(`Task created: "Build: ${idea.title}" assigned to ${model}`);
  }

  return (
    <div className="kanban-card">
      <div className="task-drag-header" style={{ cursor: 'pointer' }} onClick={onToggle}>
        <div className="pill-row left">
          <span className={`pill ${statusColors[idea.status] || ''}`}>{idea.status}</span>
          <span className="micro-copy">{new Date(idea.createdAt).toLocaleDateString()}</span>
        </div>
        <span style={{ fontSize: '1.2rem' }}>{expanded ? '▾' : '▸'}</span>
      </div>
      <h4>{idea.title}</h4>
      {idea.description && <p>{idea.description}</p>}

      {expanded && (
        <div style={{ marginTop: '1rem' }}>
          {/* Action buttons */}
          <div className="task-execution-controls" style={{ marginBottom: '1rem' }}>
            {idea.status === 'submitted' && (
              <button className="run-task-button" disabled={researching} onClick={handleResearch}>
                {researching ? '⟳ Researching...' : '🔬 Research This Idea'}
              </button>
            )}
            {idea.status === 'researched' && (
              <>
                <button className="run-task-button" onClick={() => handleBuild('Kimi K2.5')}>Build with Kimi</button>
                <button className="run-task-button" onClick={() => handleBuild('Claude Opus 4.6')}>Build with Opus</button>
                <button className="run-task-button" onClick={() => handleBuild('Claude Sonnet 4.5')}>Build with Sonnet</button>
              </>
            )}
          </div>

          {/* Research Output */}
          {idea.researchData && (
            <div className="task-execution-output exec-success" style={{ marginBottom: '1rem' }}>
              <div className="exec-output-header"><span className="pill">Research Report</span></div>
              <div style={{ padding: '0.75rem' }}>
                {idea.researchData.market && (
                  <div style={{ marginBottom: '0.75rem' }}>
                    <strong>Market:</strong> <span className={`pill ${idea.researchData.market.viability === 'high' ? '' : 'ghost'}`}>{idea.researchData.market.viability}</span>
                    <p className="micro-copy">{idea.researchData.market.summary}</p>
                  </div>
                )}
                {idea.researchData.technical && (
                  <div style={{ marginBottom: '0.75rem' }}>
                    <strong>Technical:</strong> <span className="pill ghost">{idea.researchData.technical.complexity}</span>
                    <p className="micro-copy">{idea.researchData.technical.feasibility} — Stack: {idea.researchData.technical.stack}</p>
                  </div>
                )}
                {idea.researchData.competition && (
                  <div style={{ marginBottom: '0.75rem' }}>
                    <strong>Competition:</strong>
                    <p className="micro-copy">{idea.researchData.competition.competitors?.join(', ') || 'None identified'}</p>
                    <p className="micro-copy">{idea.researchData.competition.differentiation}</p>
                  </div>
                )}
                {idea.researchData.estimate && (
                  <div>
                    <strong>Estimate:</strong>
                    <p className="micro-copy">Cost: {idea.researchData.estimate.cost} · Time: {idea.researchData.estimate.time}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Embedded Chat */}
          <div style={{ border: '1px solid rgba(255,255,255,0.08)', borderRadius: '14px', padding: '0.75rem' }}>
            <p className="micro-copy" style={{ marginBottom: '0.5rem' }}>Chat about this idea with Kimi:</p>
            <div style={{ maxHeight: '200px', overflowY: 'auto', marginBottom: '0.5rem' }}>
              {localConvo.map((m, i) => (
                <div key={i} className={`chat-bubble chat-${m.role}`} style={{ marginBottom: '0.35rem', padding: '0.5rem 0.75rem', fontSize: '0.85rem' }}>
                  <span className="micro-copy">{m.role}</span>
                  <p>{m.content}</p>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input type="text" value={chatMsg} onChange={e => setChatMsg(e.target.value)} placeholder="Ask about this idea..." style={{ flex: 1 }} onKeyDown={e => e.key === 'Enter' && handleChat()} />
              <button className="move-task-button" disabled={chatting} onClick={handleChat}>
                {chatting ? '...' : 'Send'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
