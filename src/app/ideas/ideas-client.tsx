'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

interface ResearchData {
  market?: { summary: string; viability: string; notes: string };
  technical?: { feasibility: string; stack: string; complexity: string };
  competition?: { competitors: string[]; differentiation: string };
  estimate?: { cost: string; time: string; resources: string };
}

interface ConvoMessage { role: string; content: string; timestamp: string; }

interface Idea {
  id: string;
  title: string;
  description: string | null;
  status: string;
  researchData: ResearchData | string | null;
  conversationHistory: ConvoMessage[];
  mvpCode: string | null;
  codexPrompt: string | null;
  createdAt: string;
}

/**
 * Normalize researchData which may arrive as:
 * - A proper parsed object (ideal)
 * - A JSON string (double-encoded by the DB or API)
 * - A string with escaped quotes (triple-encoded)
 * - null
 */
function normalizeResearch(raw: ResearchData | string | null | undefined): ResearchData | null {
  if (!raw) return null;

  // Already a proper object with at least one section
  if (typeof raw === 'object' && !Array.isArray(raw)) {
    if (raw.market || raw.technical || raw.competition || raw.estimate) return raw;
  }

  // It's a string — try to parse it
  if (typeof raw === 'string') {
    // Try direct parse
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && (parsed.market || parsed.technical || parsed.competition || parsed.estimate)) {
        return parsed;
      }
    } catch { /* continue */ }

    // Try unescaping then parsing
    try {
      const unescaped = raw.replace(/\\"/g, '"').replace(/\\n/g, '\n').replace(/\\\\/g, '\\');
      const start = unescaped.indexOf('{');
      const end = unescaped.lastIndexOf('}');
      if (start !== -1 && end > start) {
        const parsed = JSON.parse(unescaped.substring(start, end + 1));
        if (parsed && typeof parsed === 'object' && (parsed.market || parsed.technical || parsed.competition || parsed.estimate)) {
          return parsed;
        }
      }
    } catch { /* continue */ }
  }

  return null;
}

export function IdeasClient() {
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const fetchIdeas = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (search) params.set('q', search);
      if (statusFilter) params.set('status', statusFilter);
      const res = await fetch(`/api/ideas?${params}`);
      if (res.ok) setIdeas(await res.json());
    } catch { /* keep existing */ }
    setLoading(false);
  }, [search, statusFilter]);

  // The API is the source of truth for this existing client-managed screen.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { fetchIdeas(); }, [fetchIdeas]);

  async function handleCreate() {
    if (!title.trim()) return;
    setCreating(true);
    try {
      const res = await fetch('/api/ideas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title.trim(), description: description.trim() || undefined }),
      });
      if (res.ok) { setTitle(''); setDescription(''); await fetchIdeas(); }
    } catch { /* handled */ }
    setCreating(false);
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this idea?')) return;
    try {
      await fetch('/api/ideas', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, action: 'archive' }) });
      setIdeas(prev => prev.filter(i => i.id !== id));
      if (expandedId === id) setExpandedId(null);
    } catch { /* handled */ }
  }

  return (
    <>
      <section className="card page-ideas-accent">
        <div className="task-board-section-header">
          <div><div className="eyebrow">New Idea</div><h2>Submit an Idea</h2></div>
        </div>
        <div className="task-form-grid">
          <label className="login-field">
            <span>Title</span>
            <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="What do you want to build?" onKeyDown={e => e.key === 'Enter' && handleCreate()} />
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

      <section className="card" style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <label className="login-field" style={{ flex: 1 }}><span>Search</span><input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search ideas..." /></label>
        <label className="login-field"><span>Status</span>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="">All</option><option value="submitted">Submitted</option><option value="researching">Researching</option><option value="researched">Researched</option>
          </select>
        </label>
      </section>

      <section className="card page-ideas-accent">
        <div className="task-board-section-header"><div><div className="eyebrow">Ideas</div><h2>Your Ideas ({ideas.length})</h2></div></div>
        {loading ? <p className="micro-copy">Loading...</p> : ideas.length === 0 ? <p className="micro-copy">No ideas yet. Submit one above.</p> : (
          <div className="stack">
            {ideas.map(idea => <IdeaCard key={idea.id} idea={idea} expanded={expandedId === idea.id} onToggle={() => setExpandedId(expandedId === idea.id ? null : idea.id)} onDelete={() => handleDelete(idea.id)} onRefresh={fetchIdeas} />)}
          </div>
        )}
      </section>
    </>
  );
}

function IdeaCard({ idea, expanded, onToggle, onDelete, onRefresh }: {
  idea: Idea; expanded: boolean; onToggle: () => void; onDelete: () => void; onRefresh: () => void;
}) {
  const [researching, setResearching] = useState(false);
  const [chatMsg, setChatMsg] = useState('');
  const [chatting, setChatting] = useState(false);
  const [localConvo, setLocalConvo] = useState<ConvoMessage[]>(idea.conversationHistory || []);
  const [reportOpen, setReportOpen] = useState(false);
  const [buildingWith, setBuildingWith] = useState<string | null>(null);
  const [buildResult, setBuildResult] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Keep the expanded card in sync when its server-backed idea record changes.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setLocalConvo(idea.conversationHistory || []); }, [idea.conversationHistory]);
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [localConvo]);

  // Normalize the research data (handles string, double-encoded, or proper object)
  const research = normalizeResearch(idea.researchData);

  async function handleResearch() {
    setResearching(true);
    try {
      await fetch(`/api/ideas/${idea.id}/research`, { method: 'POST' });
      await onRefresh();
      setReportOpen(true);
    } catch { /* handled */ }
    setResearching(false);
  }

  async function handleChat() {
    if (!chatMsg.trim() || chatting) return;
    const msg = chatMsg.trim();
    setChatMsg('');
    setChatting(true);
    setLocalConvo(prev => [...prev, { role: 'user', content: msg, timestamp: new Date().toISOString() }]);
    try {
      const res = await fetch(`/api/ideas/${idea.id}/chat`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: msg }) });
      if (res.ok) {
        const data = await res.json();
        setLocalConvo(prev => [...prev, { role: 'assistant', content: data.reply, timestamp: new Date().toISOString() }]);
      } else {
        let errorText = 'Something went wrong.';
        try { const errData = await res.json(); errorText = errData.error || errorText; } catch { /* default */ }
        setLocalConvo(prev => [...prev, { role: 'assistant', content: `Error: ${errorText}`, timestamp: new Date().toISOString() }]);
      }
    } catch {
      setLocalConvo(prev => [...prev, { role: 'assistant', content: 'Error: Could not reach the server.', timestamp: new Date().toISOString() }]);
    }
    setChatting(false);
  }

  async function handleBuild() {
    setBuildingWith('coding');
    setBuildResult(null);
    try {
      const res = await fetch(`/api/ideas/${idea.id}/build`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ capability: 'coding' }),
      });
      if (res.ok) {
        const data = await res.json();
        setBuildResult(`✅ Task created: "${data.taskTitle}" assigned to ${data.assignedAi}. Go to Current Tasks to run it.`);
        onRefresh();
      } else {
        let errorText = 'Failed to create task.';
        try { const errData = await res.json(); errorText = errData.error || errorText; } catch { /* default */ }
        setBuildResult(`❌ ${errorText}`);
      }
    } catch {
      setBuildResult('❌ Could not reach the server.');
    }
    setBuildingWith(null);
  }

  return (
    <div className="kanban-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', cursor: 'pointer' }} onClick={onToggle}>
        <div style={{ flex: 1 }}>
          <div className="pill-row left" style={{ marginBottom: '0.35rem' }}>
            <span className={`pill ${idea.status === 'researched' ? '' : 'ghost'}`}>{idea.status}</span>
            <span className="micro-copy">{new Date(idea.createdAt).toLocaleDateString()}</span>
          </div>
          <h4 style={{ margin: 0 }}>{idea.title}</h4>
          {idea.description && <p className="micro-copy" style={{ marginTop: '0.25rem' }}>{idea.description}</p>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0, marginLeft: '0.75rem' }}>
          <button type="button" className="move-task-button delete-task-button" onClick={e => { e.stopPropagation(); onDelete(); }} style={{ fontSize: '0.78rem', padding: '0.3rem 0.6rem' }}>Delete</button>
          <span style={{ fontSize: '1.2rem', color: 'var(--muted)' }}>{expanded ? '▾' : '▸'}</span>
        </div>
      </div>

      {expanded && (
        <div style={{ marginTop: '1rem' }}>
          <div className="task-execution-controls" style={{ marginBottom: '1rem' }}>
            {idea.status === 'submitted' && <button className="run-task-button" disabled={researching} onClick={handleResearch}>{researching ? '⟳ Researching...' : '🔬 Research This Idea'}</button>}
            {idea.status === 'researching' && <span className="pill highlight">⟳ Research in progress...</span>}
          </div>

          {/* RESEARCH REPORT */}
          {research && <Report data={research} isOpen={reportOpen} onToggle={() => setReportOpen(!reportOpen)} />}

          {/* If we have researchData but couldn't parse it, show a hint */}
          {!research && idea.researchData && (
            <div style={{ padding: '0.75rem', marginBottom: '1rem', borderRadius: '12px', border: '1px solid rgba(245,158,11,0.3)', background: 'rgba(245,158,11,0.08)' }}>
              <p style={{ color: '#f59e0b', fontSize: '0.85rem', margin: 0 }}>Research data exists but could not be displayed. Delete this idea and create a new one to re-run research.</p>
            </div>
          )}

          {/* BUILD BUTTONS — shown after research is complete */}
          {(idea.status === 'researched' || idea.status === 'building' || idea.status === 'built') && research && (
            <div style={{ marginBottom: '1rem', padding: '0.85rem', borderRadius: '14px', border: '1px solid rgba(16,185,129,0.2)', background: 'rgba(16,185,129,0.05)' }}>
              <h4 style={{ margin: '0 0 0.6rem 0', fontSize: '0.9rem' }}>🚀 Build This Idea</h4>
              <p style={{ color: 'rgba(158,179,201,1)', fontSize: '0.82rem', margin: '0 0 0.75rem 0' }}>
                Create a fully scoped task for the Coding capability. Mission Control will choose the best available provider when you manually run it.
              </p>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <button
                  className="run-task-button"
                  disabled={!!buildingWith}
                  onClick={handleBuild}
                >
                  {buildingWith ? '⟳ Creating...' : 'Prepare coding task automatically'}
                </button>
              </div>
              {buildResult && (
                <p style={{ marginTop: '0.6rem', fontSize: '0.85rem', color: buildResult.startsWith('✅') ? '#10b981' : '#ec4899' }}>
                  {buildResult}
                </p>
              )}
            </div>
          )}

          {/* CHAT */}
          <div style={{ border: '1px solid rgba(255,255,255,0.08)', borderRadius: '14px', padding: '0.85rem', background: 'rgba(0,0,0,0.1)', marginTop: '1rem' }}>
            <h4 style={{ margin: '0 0 0.6rem 0', fontSize: '0.9rem' }}>💬 Chat about this idea</h4>
            <div style={{ maxHeight: '250px', overflowY: 'auto', marginBottom: '0.6rem' }}>
              {localConvo.length === 0 && <p className="micro-copy">No messages yet. Ask Mission Control anything about this idea.</p>}
              {localConvo.map((m, i) => (
                <div key={i} className={`chat-bubble chat-${m.role}`} style={{ marginBottom: '0.4rem', padding: '0.5rem 0.75rem', fontSize: '0.85rem' }}>
                  <span className="micro-copy chat-role-label">{m.role === 'assistant' ? 'Mission Control' : 'You'}</span>
                  <p>{m.content}</p>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input type="text" value={chatMsg} onChange={e => setChatMsg(e.target.value)} placeholder="Ask about this idea..." onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleChat(); } }} disabled={chatting} style={{ flex: 1, padding: '0.5rem 0.75rem', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', color: 'var(--foreground)', fontSize: '0.85rem' }} />
              <button className="login-button" disabled={chatting || !chatMsg.trim()} onClick={handleChat} style={{ padding: '0.5rem 1rem' }}>{chatting ? '...' : 'Send'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   RESEARCH REPORT — 100% inline styles, no CSS dependencies
   ══════════════════════════════════════════════════════════════ */

function Report({ data, isOpen, onToggle }: { data: ResearchData; isOpen: boolean; onToggle: () => void }) {
  return (
    <div style={{ marginBottom: '1.25rem', borderRadius: '16px', border: '1px solid rgba(56,189,248,0.2)', overflow: 'hidden', background: 'rgba(0,0,0,0.15)' }}>
      {/* Clickable header */}
      <div onClick={onToggle} style={{ padding: '0.75rem 1rem', background: 'rgba(56,189,248,0.08)', borderBottom: isOpen ? '1px solid rgba(56,189,248,0.12)' : 'none', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>📋 Research Report</h4>
        <span style={{ fontSize: '0.85rem', color: 'rgba(158,179,201,0.8)' }}>{isOpen ? '▾ Hide Report' : '▸ Show Report'}</span>
      </div>

      {/* Report body — only rendered when open */}
      {isOpen && (
        <div>
          {data.market && (
            <Section color="rgba(56,189,248,0.6)" icon="📊" title="Market Analysis" badge={<Badge label={data.market.viability} type="viability" />}>
              <P>{data.market.summary}</P>
              {data.market.notes && data.market.notes !== data.market.summary && <P style={{ color: 'rgba(95,112,132,1)', fontStyle: 'italic', fontSize: '0.82rem' }}>{data.market.notes}</P>}
            </Section>
          )}
          {data.technical && (
            <Section color="rgba(139,92,246,0.6)" icon="⚙️" title="Technical Feasibility" badge={<Badge label={data.technical.complexity} type="complexity" />}>
              <P>{data.technical.feasibility}</P>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem', fontSize: '0.85rem' }}>
                <span style={{ color: 'rgba(95,112,132,1)' }}>Recommended Stack:</span>
                <strong style={{ fontWeight: 600 }}>{data.technical.stack}</strong>
              </div>
            </Section>
          )}
          {data.competition && (
            <Section color="rgba(245,158,11,0.6)" icon="🏆" title="Competition">
              {data.competition.competitors?.length > 0 ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginBottom: '0.5rem' }}>
                  {data.competition.competitors.map((c, i) => <span key={i} className="pill ghost">{c}</span>)}
                </div>
              ) : <P style={{ color: '#10b981' }}>No direct competitors identified.</P>}
              <P>{data.competition.differentiation}</P>
            </Section>
          )}
          {data.estimate && (
            <Section color="rgba(16,185,129,0.6)" icon="💰" title="Cost & Timeline" last>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem', marginTop: '0.35rem' }}>
                <EstimateBox label="Cost" value={data.estimate.cost} />
                <EstimateBox label="Timeline" value={data.estimate.time} />
                <EstimateBox label="Resources" value={data.estimate.resources} />
              </div>
            </Section>
          )}
        </div>
      )}
    </div>
  );
}

function Section({ color, icon, title, badge, last, children }: { color: string; icon: string; title: string; badge?: React.ReactNode; last?: boolean; children: React.ReactNode }) {
  return (
    <div style={{ padding: '1rem 1.1rem', borderBottom: last ? 'none' : '1px solid rgba(255,255,255,0.05)', borderLeft: `3px solid ${color}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.6rem' }}>
        <span>{icon}</span>
        <h5 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600 }}>{title}</h5>
        {badge}
      </div>
      {children}
    </div>
  );
}

function P({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <p style={{ color: 'rgba(158,179,201,1)', lineHeight: '1.65', fontSize: '0.9rem', margin: '0.3rem 0', ...style }}>{children}</p>;
}

function EstimateBox({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ padding: '0.6rem 0.75rem', borderRadius: '12px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
      <span style={{ display: 'block', fontSize: '0.75rem', color: 'rgba(95,112,132,1)', marginBottom: '0.2rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</span>
      <strong style={{ fontSize: '0.88rem', fontWeight: 600 }}>{value}</strong>
    </div>
  );
}

function Badge({ label, type }: { label: string; type: 'viability' | 'complexity' }) {
  const l = (label || '').toLowerCase();
  let bg: string, fg: string, bd: string;

  if (type === 'viability') {
    if (l === 'high') { bg = 'rgba(16,185,129,0.18)'; fg = '#10b981'; bd = 'rgba(16,185,129,0.35)'; }
    else if (l === 'medium') { bg = 'rgba(245,158,11,0.15)'; fg = '#f59e0b'; bd = 'rgba(245,158,11,0.3)'; }
    else if (l === 'low') { bg = 'rgba(236,72,153,0.15)'; fg = '#ec4899'; bd = 'rgba(236,72,153,0.3)'; }
    else { bg = 'rgba(255,255,255,0.05)'; fg = '#9eb3c9'; bd = 'rgba(255,255,255,0.1)'; }
  } else {
    if (l === 'low') { bg = 'rgba(16,185,129,0.15)'; fg = '#10b981'; bd = 'rgba(16,185,129,0.3)'; }
    else if (l === 'medium') { bg = 'rgba(56,189,248,0.15)'; fg = '#38bdf8'; bd = 'rgba(56,189,248,0.3)'; }
    else if (l === 'high') { bg = 'rgba(139,92,246,0.15)'; fg = '#8b5cf6'; bd = 'rgba(139,92,246,0.3)'; }
    else { bg = 'rgba(255,255,255,0.05)'; fg = '#9eb3c9'; bd = 'rgba(255,255,255,0.1)'; }
  }

  return <span style={{ padding: '0.15rem 0.55rem', borderRadius: '20px', fontSize: '0.72rem', fontWeight: 600, background: bg, color: fg, border: `1px solid ${bd}`, textTransform: 'capitalize' }}>{label || 'Unknown'}</span>;
}
