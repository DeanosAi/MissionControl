'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';

import styles from './sprint-16-concepts.module.css';

type ConceptId = 'command' | 'workspace' | 'voice';
type ViewId = 'today' | 'workspace' | 'providers';
type PersonaState = 'greeting' | 'thinking' | 'listening' | 'celebrating' | 'warning' | 'waiting';
type DecisionState = 'pending' | 'approved' | 'changes' | 'rejected';

const concepts: Array<{
  id: ConceptId;
  number: string;
  name: string;
  shortName: string;
  philosophy: string;
  strengths: string[];
  weaknesses: string[];
  suitability: string;
  recommended?: boolean;
}> = [
  {
    id: 'command',
    number: '01',
    name: 'Command Centre',
    shortName: 'Command Centre',
    philosophy: 'A calm daily overview leads with the next decision, current work, and one universal command field.',
    strengths: ['Fast morning orientation', 'Strongest overview', 'Familiar evolution'],
    weaknesses: ['Conversation is less central', 'Long decisions need a focused view'],
    suitability: 'Best when Mission Control is opened first as a daily operating dashboard.',
  },
  {
    id: 'workspace',
    number: '02',
    name: 'Conversation Workspace',
    shortName: 'Workspace',
    philosophy: 'A focused decision surface combines structured proposals, live context, capability progress, and persistent approval.',
    strengths: ['Best decision clarity', 'Scannable proposals', 'Balanced transparency'],
    weaknesses: ['Largest responsive change', 'Context relevance must be disciplined'],
    suitability: 'Best fit for an AI operating system whose central job is helping the user make and approve good decisions.',
    recommended: true,
  },
  {
    id: 'voice',
    number: '03',
    name: 'Voice-first Assistant',
    shortName: 'Voice-first',
    philosophy: 'A listening surface and concise response sheet make conversation effortless while retaining visible control.',
    strengths: ['Strongest mobile future', 'Lowest visual load', 'Most coherent persona'],
    weaknesses: ['Detailed comparison needs another surface', 'Voice is not implemented yet'],
    suitability: 'Best long-term interaction model for quick requests, status checks, and approvals on the move.',
  },
];

const providerRows = [
  {
    name: 'OpenAI',
    status: 'Available',
    health: 'Healthy',
    capability: 'Complex reasoning',
    cost: '$$',
    reason: 'Recommended when long context and broad capability matter.',
    tone: 'cyan',
  },
  {
    name: 'Anthropic',
    status: 'Connected',
    health: 'Healthy',
    capability: 'Product critique',
    cost: '$$',
    reason: 'Strong fit for careful critique, planning, and documentation.',
    tone: 'violet',
  },
  {
    name: 'Moonshot',
    status: 'Connected',
    health: 'Healthy',
    capability: 'Value reasoning',
    cost: '$',
    reason: 'Recommended for cost-aware research and everyday analysis.',
    tone: 'amber',
  },
  {
    name: 'Local models',
    status: '1 enabled',
    health: 'On demand',
    capability: 'Private tasks',
    cost: 'Local',
    reason: 'Preferred when privacy matters and local capability is sufficient.',
    tone: 'green',
  },
];

const proposalSections = [
  {
    id: 'alternatives',
    label: 'Alternative options',
    summary: 'Two credible alternatives were considered.',
  },
  {
    id: 'tradeoffs',
    label: 'Trade-offs',
    summary: 'The recommendation balances usability, implementation effort, and accessibility.',
  },
  {
    id: 'reasoning',
    label: 'Reasoning',
    summary: 'The Decision Engine compared fit, risk, cost, and long-term flexibility.',
  },
  {
    id: 'memory',
    label: 'Memory used',
    summary: '4 relevant project decisions and 2 user preferences informed this proposal.',
  },
  {
    id: 'impact',
    label: 'Project impact',
    summary: 'Extends the existing UI shell without changing the Decision Engine or approvals.',
  },
];

function PersonaMark({
  state,
  compact = false,
}: {
  state: PersonaState;
  compact?: boolean;
}) {
  return (
    <div
      className={`${styles.persona} ${styles[`persona_${state}`]} ${compact ? styles.personaCompact : ''}`}
      aria-label={`Mission Control persona is ${state}`}
    >
      <span className={styles.personaHalo} />
      <span className={styles.personaCore}>MC</span>
    </div>
  );
}

function StatusDot({ tone = 'green' }: { tone?: 'green' | 'amber' | 'cyan' }) {
  return <span className={`${styles.statusDot} ${styles[`status_${tone}`]}`} aria-hidden="true" />;
}

function SystemHeader({ concept }: { concept: ConceptId }) {
  return (
    <header className={`${styles.systemHeader} ${styles[`systemHeader_${concept}`]}`}>
      <div className={styles.projectIdentity}>
        <PersonaMark state="thinking" compact />
        <div>
          <span className={styles.microLabel}>Current project</span>
          <strong>Mission Control V3</strong>
        </div>
      </div>
      <div className={styles.headerFacts}>
        <div>
          <span>Phase</span>
          <strong>Proposal</strong>
        </div>
        <div>
          <span>Progress</span>
          <strong>72%</strong>
        </div>
        <div>
          <span>Capabilities</span>
          <strong>3 active</strong>
        </div>
        <div>
          <span>Cost</span>
          <strong>$0.08</strong>
        </div>
        <div>
          <span>Research</span>
          <strong className={styles.inlineHealthy}><StatusDot /> Current</strong>
        </div>
      </div>
      <div className={styles.approvalBadge}><StatusDot tone="amber" /> Approval needed</div>
    </header>
  );
}

function ViewTabs({
  value,
  onChange,
}: {
  value: ViewId;
  onChange: (value: ViewId) => void;
}) {
  const items: Array<{ id: ViewId; label: string; count?: number }> = [
    { id: 'today', label: 'Today' },
    { id: 'workspace', label: 'Workspace', count: 1 },
    { id: 'providers', label: 'AI Providers' },
  ];
  return (
    <nav className={styles.viewTabs} aria-label="Concept views">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          data-view={item.id}
          className={value === item.id ? styles.viewTabActive : ''}
          onClick={() => onChange(item.id)}
        >
          {item.label}
          {item.count ? <span>{item.count}</span> : null}
        </button>
      ))}
    </nav>
  );
}

function CapabilityTrail({ compact = false }: { compact?: boolean }) {
  const capabilities = [
    ['Planning', 'Complete'],
    ['UI Design', 'Complete'],
    ['Memory', 'Complete'],
    ['Security', 'Reviewing'],
  ];
  return (
    <div className={`${styles.capabilityTrail} ${compact ? styles.capabilityTrailCompact : ''}`}>
      {capabilities.map(([name, status], index) => (
        <div className={styles.capabilityStep} key={name}>
          <span className={index < 3 ? styles.capabilityComplete : styles.capabilityActive}>
            {index < 3 ? '✓' : index + 1}
          </span>
          <div>
            <strong>{name}</strong>
            <small>{status}</small>
          </div>
        </div>
      ))}
    </div>
  );
}

function ApprovalControls({
  decision,
  onDecision,
  vertical = false,
}: {
  decision: DecisionState;
  onDecision: (decision: DecisionState) => void;
  vertical?: boolean;
}) {
  if (decision !== 'pending') {
    const labels: Record<Exclude<DecisionState, 'pending'>, string> = {
      approved: 'Direction approved',
      changes: 'Changes requested',
      rejected: 'Proposal rejected',
    };
    return (
      <div className={styles.decisionConfirmation} role="status">
        <span>{decision === 'approved' ? '✓' : decision === 'changes' ? '↺' : '×'}</span>
        <div>
          <strong>{labels[decision]}</strong>
          <button type="button" onClick={() => onDecision('pending')}>Undo prototype action</button>
        </div>
      </div>
    );
  }

  return (
    <div className={`${styles.approvalControls} ${vertical ? styles.approvalControlsVertical : ''}`}>
      <button type="button" className={styles.primaryAction} onClick={() => onDecision('approved')}>
        Approve direction
      </button>
      <button type="button" onClick={() => onDecision('changes')}>Request changes</button>
      <button type="button" onClick={() => onDecision('rejected')}>Reject</button>
    </div>
  );
}

function ProposalWorkspace({
  openSections,
  toggleSection,
  selectedOption,
  setSelectedOption,
}: {
  openSections: Set<string>;
  toggleSection: (id: string) => void;
  selectedOption: string;
  setSelectedOption: (value: string) => void;
}) {
  return (
    <section className={styles.proposalSurface}>
      <article className={styles.executiveCard}>
        <div className={styles.cardTopline}>
          <span className={styles.cardLabel}>Executive summary</span>
          <span className={styles.confidenceBadge}>High confidence</span>
        </div>
        <h2>A flexible theme system that feels personal, not cosmetic</h2>
        <p>
          Add three curated visual themes and a simple appearance control. Preserve accessibility,
          remember the choice across devices, and keep future brand themes easy to add.
        </p>
      </article>

      <article className={styles.recommendationCard}>
        <div className={styles.recommendationIcon}>01</div>
        <div>
          <span className={styles.cardLabel}>Recommended solution</span>
          <h3>Curated themes with system-aware defaults</h3>
          <p>
            Start with Mission Dark, Focus Light, and Cobalt. Each theme uses semantic design tokens,
            passes contrast checks, and can be previewed before saving.
          </p>
          <div className={styles.choiceRow}>
            {['Curated themes', 'Single accent', 'Full customiser'].map((option) => (
              <button
                type="button"
                key={option}
                className={selectedOption === option ? styles.choiceActive : ''}
                onClick={() => setSelectedOption(option)}
              >
                {option}
              </button>
            ))}
          </div>
        </div>
      </article>

      <div className={styles.expandableStack}>
        {proposalSections.map((section) => {
          const open = openSections.has(section.id);
          return (
            <article className={styles.expandableCard} key={section.id}>
              <button type="button" onClick={() => toggleSection(section.id)} aria-expanded={open}>
                <span>
                  <strong>{section.label}</strong>
                  <small>{section.summary}</small>
                </span>
                <span className={styles.expandIcon}>{open ? '−' : '+'}</span>
              </button>
              {open ? (
                <div className={styles.expandableContent}>
                  {section.id === 'alternatives' ? (
                    <div className={styles.optionComparison}>
                      <div>
                        <span>Option B</span>
                        <strong>Single accent colour</strong>
                        <p>Fast and safe, but does not meaningfully change the interface atmosphere.</p>
                      </div>
                      <div>
                        <span>Option C</span>
                        <strong>Full visual customiser</strong>
                        <p>Maximum flexibility, with significantly more complexity and accessibility risk.</p>
                      </div>
                    </div>
                  ) : (
                    <p>
                      {section.summary} This detail remains available for trust and auditability without
                      competing with the recommendation.
                    </p>
                  )}
                </div>
              ) : null}
            </article>
          );
        })}
      </div>

      <article className={styles.previewCard}>
        <div className={styles.cardTopline}>
          <div>
            <span className={styles.cardLabel}>UI preview</span>
            <h3>Appearance settings</h3>
          </div>
          <button type="button" className={styles.textAction}>Open full preview</button>
        </div>
        <div className={styles.themePreviewGrid}>
          {[
            ['Mission Dark', '#111b2d', '#54d6ff'],
            ['Focus Light', '#eef3f6', '#176a85'],
            ['Cobalt', '#101c3b', '#7aa2ff'],
          ].map(([name, background, accent], index) => (
            <button type="button" className={index === 0 ? styles.themeSelected : ''} key={name}>
              <span className={styles.themeSwatch} style={{ background }}>
                <i style={{ background: accent }} />
                <i />
                <i />
              </span>
              <strong>{name}</strong>
              <small>{index === 0 ? 'Current' : 'Preview'}</small>
            </button>
          ))}
        </div>
      </article>
    </section>
  );
}

function ContextPanel() {
  const groups: Array<[string, string[]]> = [
    ['Relevant memories', ['Prefers low-friction controls', 'Mobile is the primary device']],
    ['Recent decisions', ['Keep interfaces visually distinct', 'Approval before external tools']],
    ['Open tasks', ['Review Sprint 1.6 concepts']],
    ['Research findings', ['Semantic tokens reduce theme maintenance']],
    ['Recently learned', ['Structured cards are easier to scan']],
  ];
  return (
    <aside className={styles.contextPanel}>
      <div className={styles.contextHeading}>
        <div>
          <span className={styles.cardLabel}>Live context</span>
          <h3>Why this is relevant</h3>
        </div>
        <span className={styles.contextCount}>7</span>
      </div>
      <div className={styles.contextProject}>
        <span>Current project</span>
        <strong>Mission Control V3</strong>
        <small>Related: Design system foundation</small>
      </div>
      {groups.map(([label, items]) => (
        <details key={label} open={label === 'Relevant memories' || label === 'Recent decisions'}>
          <summary>{label}<span>{items.length}</span></summary>
          <ul>{items.map((item) => <li key={item}>{item}</li>)}</ul>
        </details>
      ))}
    </aside>
  );
}

function ProvidersView() {
  const [selectedProvider, setSelectedProvider] = useState('OpenAI');
  const [enabledProviders, setEnabledProviders] = useState(() => new Set(providerRows.map((provider) => provider.name)));
  const selected = providerRows.find((provider) => provider.name === selectedProvider) ?? providerRows[0];

  function toggleProvider(name: string) {
    setEnabledProviders((current) => {
      const next = new Set(current);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  return (
    <section className={styles.providersView}>
      <div className={styles.providersIntro}>
        <div>
          <span className={styles.cardLabel}>AI Provider Management</span>
          <h2>Capabilities first. Providers stay replaceable.</h2>
          <p>Credentials are write-only. Mission Control explains selection, cost, privacy, and health in plain English.</p>
        </div>
        <button type="button" className={styles.secondaryAction}>+ Add provider</button>
      </div>

      <div className={styles.providerLayout}>
        <div className={styles.providerList}>
          {providerRows.map((provider) => {
            const enabled = enabledProviders.has(provider.name);
            return (
              <div
                key={provider.name}
                className={`${styles.providerRow} ${selectedProvider === provider.name ? styles.providerRowSelected : ''}`}
              >
                <button
                  type="button"
                  className={styles.providerSelect}
                  onClick={() => setSelectedProvider(provider.name)}
                >
                  <span className={`${styles.providerMonogram} ${styles[`provider_${provider.tone}`]}`}>
                    {provider.name.slice(0, 2)}
                  </span>
                  <span className={styles.providerIdentity}>
                    <strong>{provider.name}</strong>
                    <small><StatusDot /> {enabled ? provider.status : 'Disabled'}</small>
                  </span>
                  <span className={styles.providerCapability}>{provider.capability}</span>
                  <span className={styles.providerCost}>{provider.cost}</span>
                </button>
                <button
                  type="button"
                  role="switch"
                  aria-checked={enabled}
                  aria-label={`${enabled ? 'Disable' : 'Enable'} ${provider.name}`}
                  className={`${styles.toggle} ${enabled ? styles.toggleOn : ''}`}
                  onClick={() => toggleProvider(provider.name)}
                >
                  <i />
                </button>
              </div>
            );
          })}
        </div>

        <aside className={styles.providerDetail}>
          <div className={styles.providerDetailHeader}>
            <span className={`${styles.providerMonogram} ${styles[`provider_${selected.tone}`]}`}>
              {selected.name.slice(0, 2)}
            </span>
            <div>
              <span className={styles.cardLabel}>Provider profile</span>
              <h3>{selected.name}</h3>
            </div>
            <span className={styles.healthBadge}><StatusDot /> {selected.health}</span>
          </div>
          <div className={styles.providerFacts}>
            <div><span>Last successful call</span><strong>12 minutes ago</strong></div>
            <div><span>Priority weighting</span><strong>82 / 100</strong></div>
            <div><span>API key</span><strong>Configured ···· 4F8A</strong></div>
            <div><span>Estimated pricing</span><strong>{selected.cost} · reviewed Jul 2026</strong></div>
          </div>
          <div className={styles.providerRecommendation}>
            <span className={styles.cardLabel}>Why Mission Control recommends it</span>
            <p>{selected.reason}</p>
          </div>
          <div className={styles.strengthGrid}>
            <div><strong>Strengths</strong><p>Reliable, broad capability, strong context handling.</p></div>
            <div><strong>Weaknesses</strong><p>Paid usage and external data processing.</p></div>
            <div><strong>Privacy</strong><p>Cloud provider. Avoid for private work when a capable local route exists.</p></div>
            <div><strong>Typical use</strong><p>{selected.capability}, architecture, and complex planning.</p></div>
          </div>
          <div className={styles.providerActions}>
            <button type="button" className={styles.primaryAction}>Test connection</button>
            <button type="button">Update credential</button>
          </div>
        </aside>
      </div>
    </section>
  );
}

function TodayView({ concept }: { concept: ConceptId }) {
  return (
    <section className={`${styles.todayView} ${styles[`todayView_${concept}`]}`}>
      <div className={styles.greetingPanel}>
        <PersonaMark state="greeting" />
        <div>
          <span className={styles.cardLabel}>Friday · 24 July</span>
          <h2>Good morning, Dean.</h2>
          <p>One decision needs you. Everything else is moving normally.</p>
          <div className={styles.commandInput}>
            <span>⌁</span>
            <span>Ask Mission Control anything…</span>
            <kbd>⌘ K</kbd>
          </div>
        </div>
      </div>
      <div className={styles.priorityGrid}>
        <article className={styles.priorityCard}>
          <div className={styles.cardTopline}>
            <span className={styles.cardLabel}>Needs your attention</span>
            <span className={styles.countBadge}>1</span>
          </div>
          <h3>Theme personalisation proposal</h3>
          <p>Recommendation and UI preview are ready.</p>
          <button type="button" className={styles.textAction}>Review decision →</button>
        </article>
        <article className={styles.priorityCard}>
          <span className={styles.cardLabel}>In progress</span>
          <h3>2 projects have motion</h3>
          <div className={styles.progressRow}><span><i style={{ width: '72%' }} /></span><strong>72%</strong></div>
          <p>Mission Control V3 · Provider architecture audit</p>
        </article>
        <article className={styles.priorityCard}>
          <span className={styles.cardLabel}>Weekly research</span>
          <h3>3 findings worth reviewing</h3>
          <p>One recommended, two optional. No technology was adopted.</p>
          <button type="button" className={styles.textAction}>View findings →</button>
        </article>
        <article className={styles.priorityCard}>
          <span className={styles.cardLabel}>Recently learned</span>
          <h3>Keep decisions compact on mobile</h3>
          <p>Approval completion improved when the recommendation stayed visible.</p>
          <button type="button" className={styles.textAction}>Why this changed →</button>
        </article>
      </div>
      <article className={styles.runningPanel}>
        <div>
          <span className={styles.cardLabel}>Capability activity</span>
          <h3>Mission Control is preparing your decision</h3>
        </div>
        <CapabilityTrail compact />
      </article>
    </section>
  );
}

function CommandCentre({
  view,
  setView,
  openSections,
  toggleSection,
  selectedOption,
  setSelectedOption,
  decision,
  setDecision,
}: ConceptProps) {
  return (
    <div className={`${styles.conceptApp} ${styles.commandApp}`}>
      <SystemHeader concept="command" />
      <div className={styles.commandBody}>
        <aside className={styles.commandNav}>
          <div className={styles.commandBrand}><PersonaMark state="waiting" compact /><strong>Mission Control</strong></div>
          <ViewTabs value={view} onChange={setView} />
          <div className={styles.commandNavSection}>
            <span>Workspace</span>
            <button type="button">Projects <small>3</small></button>
            <button type="button">Tasks <small>1</small></button>
            <button type="button">Memory</button>
            <button type="button">Research <small>3</small></button>
          </div>
          <div className={styles.commandNavFooter}><StatusDot /> All systems healthy</div>
        </aside>
        <main className={styles.commandMain}>
          <ViewTabs value={view} onChange={setView} />
          {view === 'today' ? <TodayView concept="command" /> : null}
          {view === 'workspace' ? (
            <div className={styles.commandWorkspace}>
              <div>
                <CapabilityTrail />
                <ProposalWorkspace
                  openSections={openSections}
                  toggleSection={toggleSection}
                  selectedOption={selectedOption}
                  setSelectedOption={setSelectedOption}
                />
              </div>
              <aside className={styles.commandDecisionRail}>
                <span className={styles.cardLabel}>Decision required</span>
                <h3>Ready when you are</h3>
                <p>Approve the product direction only. No build or deployment begins.</p>
                <ApprovalControls decision={decision} onDecision={setDecision} vertical />
                <button type="button" className={styles.textAction}>Compare all options</button>
                <button type="button" className={styles.textAction}>View full proposal</button>
              </aside>
            </div>
          ) : null}
          {view === 'providers' ? <ProvidersView /> : null}
        </main>
      </div>
    </div>
  );
}

interface ConceptProps {
  view: ViewId;
  setView: (value: ViewId) => void;
  openSections: Set<string>;
  toggleSection: (id: string) => void;
  selectedOption: string;
  setSelectedOption: (value: string) => void;
  decision: DecisionState;
  setDecision: (value: DecisionState) => void;
}

function ConversationWorkspace(props: ConceptProps) {
  const [contextOpen, setContextOpen] = useState(false);
  return (
    <div className={`${styles.conceptApp} ${styles.workspaceApp}`}>
      <SystemHeader concept="workspace" />
      <div className={styles.workspaceToolbar}>
        <div className={styles.workspaceBrand}><PersonaMark state="thinking" compact /><strong>Mission Control</strong></div>
        <ViewTabs value={props.view} onChange={props.setView} />
        <button type="button" className={styles.contextToggle} onClick={() => setContextOpen((value) => !value)}>
          Context <span>7</span>
        </button>
      </div>
      {props.view === 'today' ? (
        <main className={styles.workspaceToday}><TodayView concept="workspace" /></main>
      ) : null}
      {props.view === 'providers' ? (
        <main className={styles.workspaceProviders}><ProvidersView /></main>
      ) : null}
      {props.view === 'workspace' ? (
        <main className={styles.workspaceGrid}>
          <div className={`${styles.workspaceContext} ${contextOpen ? styles.workspaceContextOpen : ''}`}>
            <ContextPanel />
          </div>
          <div className={styles.workspaceConversation}>
            <div className={styles.requestCard}>
              <span>You asked</span>
              <p>Plan a feature that allows me to change the colour theme of Mission Control.</p>
            </div>
            <CapabilityTrail />
            <ProposalWorkspace
              openSections={props.openSections}
              toggleSection={props.toggleSection}
              selectedOption={props.selectedOption}
              setSelectedOption={props.setSelectedOption}
            />
            <div className={styles.replyComposer}>
              <span>⌁</span>
              <span>Ask a follow-up or request a change…</span>
              <button type="button">Send</button>
            </div>
          </div>
          <aside className={styles.workspaceApproval}>
            <div>
              <span className={styles.cardLabel}>Approval checkpoint</span>
              <h3>Approve the direction?</h3>
              <p>This approves planning only. Implementation remains blocked.</p>
            </div>
            <ApprovalControls decision={props.decision} onDecision={props.setDecision} vertical />
            <div className={styles.approvalLinks}>
              <button type="button">View full proposal</button>
              <button type="button">Compare options</button>
            </div>
            <div className={styles.approvalScope}>
              <StatusDot tone="amber" />
              <span>No code, task, purchase, or deployment will begin.</span>
            </div>
          </aside>
          <div className={styles.mobileApprovalBar}>
            <div><span>Approval needed</span><strong>Theme personalisation</strong></div>
            <ApprovalControls decision={props.decision} onDecision={props.setDecision} />
          </div>
        </main>
      ) : null}
    </div>
  );
}

function VoiceFirst(props: ConceptProps) {
  const [personaState, setPersonaState] = useState<PersonaState>('waiting');
  const [listening, setListening] = useState(false);

  function toggleListening() {
    setListening((current) => {
      setPersonaState(current ? 'waiting' : 'listening');
      return !current;
    });
  }

  return (
    <div className={`${styles.conceptApp} ${styles.voiceApp}`}>
      <SystemHeader concept="voice" />
      <div className={styles.voiceTopbar}>
        <div className={styles.voiceBrand}><PersonaMark state={personaState} compact /><strong>Mission Control</strong></div>
        <ViewTabs value={props.view} onChange={props.setView} />
        <button type="button" className={styles.voiceProfile}>DB</button>
      </div>

      {props.view === 'today' ? <TodayView concept="voice" /> : null}
      {props.view === 'providers' ? <div className={styles.voiceProviders}><ProvidersView /></div> : null}
      {props.view === 'workspace' ? (
        <main className={styles.voiceStage}>
          <section className={styles.voiceHero}>
            <div className={styles.voiceStateLabel}>
              <StatusDot tone={listening ? 'cyan' : 'green'} />
              {listening ? 'Listening' : 'Ready when you are'}
            </div>
            <PersonaMark state={personaState} />
            <h2>{listening ? 'I’m listening…' : 'What should we work through?'}</h2>
            <p>Speak naturally. Mission Control will confirm the request before making a consequential decision.</p>
            <button
              type="button"
              className={`${styles.voiceButton} ${listening ? styles.voiceButtonActive : ''}`}
              onClick={toggleListening}
            >
              <span>{listening ? '■' : '●'}</span>
              {listening ? 'Stop listening' : 'Hold to speak'}
            </button>
            <div className={styles.voicePrompts}>
              <button type="button">What needs my attention?</button>
              <button type="button">Show my approvals</button>
              <button type="button">What changed this week?</button>
            </div>
          </section>

          <section className={styles.voiceResponseSheet}>
            <div className={styles.sheetHandle} />
            <div className={styles.voiceTranscript}>
              <span className={styles.cardLabel}>I understood</span>
              <p>“Add colour themes to Mission Control without making the interface harder to use.”</p>
              <button type="button">Edit</button>
            </div>
            <div className={styles.voiceSummary}>
              <div className={styles.cardTopline}>
                <span className={styles.cardLabel}>Recommendation</span>
                <span className={styles.confidenceBadge}>High confidence</span>
              </div>
              <h3>Start with three curated, accessible themes</h3>
              <p>It gives you meaningful choice while protecting consistency and readability.</p>
              <details>
                <summary>Hear or view the reasoning <span>+</span></summary>
                <p>The Decision Engine compared a simple accent picker, curated themes, and a full customiser.</p>
              </details>
              <div className={styles.voicePreview}>
                <span style={{ background: '#101b2c' }} />
                <span style={{ background: '#eef3f6' }} />
                <span style={{ background: '#142247' }} />
                <strong>3 UI concepts ready</strong>
              </div>
            </div>
            <div className={styles.voiceApproval}>
              <div><span className={styles.cardLabel}>Your decision</span><small>Planning only · no build begins</small></div>
              <ApprovalControls decision={props.decision} onDecision={props.setDecision} />
            </div>
          </section>
        </main>
      ) : null}

      <div className={styles.personaStateDock}>
        <span>Persona framework</span>
        {(['greeting', 'thinking', 'listening', 'celebrating', 'warning', 'waiting'] as PersonaState[]).map((state) => (
          <button
            type="button"
            key={state}
            className={personaState === state ? styles.personaStateActive : ''}
            onClick={() => {
              setPersonaState(state);
              setListening(state === 'listening');
            }}
          >
            {state}
          </button>
        ))}
      </div>
    </div>
  );
}

export function Sprint16ConceptLab() {
  const [conceptId, setConceptId] = useState<ConceptId>('workspace');
  const [view, setView] = useState<ViewId>('workspace');
  const [openSections, setOpenSections] = useState(() => new Set(['alternatives']));
  const [selectedOption, setSelectedOption] = useState('Curated themes');
  const [decision, setDecision] = useState<DecisionState>('pending');
  const selectedConcept = useMemo(
    () => concepts.find((concept) => concept.id === conceptId) ?? concepts[1],
    [conceptId],
  );

  function toggleSection(id: string) {
    setOpenSections((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const conceptProps: ConceptProps = {
    view,
    setView: (next) => {
      setView(next);
      setDecision('pending');
    },
    openSections,
    toggleSection,
    selectedOption,
    setSelectedOption,
    decision,
    setDecision,
  };

  return (
    <main className={styles.lab}>
      <header className={styles.labHeader}>
        <div>
          <Link href="/chat" className={styles.backLink}>← Back to current Mission Control</Link>
          <div className={styles.labTitleRow}>
            <div>
              <span className={styles.labEyebrow}>Sprint 1.6 · Design gate</span>
              <h1>Human-centred Mission Control</h1>
            </div>
            <span className={styles.prototypeBadge}>Interactive prototype · no live actions</span>
          </div>
          <p>Three product directions using the same real architecture, approval boundary, and mobile-first priorities.</p>
        </div>
      </header>

      <section className={styles.conceptPicker} aria-label="Choose a UI concept">
        {concepts.map((concept) => (
          <button
            type="button"
            key={concept.id}
            data-concept={concept.id}
            className={conceptId === concept.id ? styles.conceptPickerActive : ''}
            onClick={() => {
              setConceptId(concept.id);
              setDecision('pending');
            }}
          >
            <span>{concept.number}</span>
            <strong>{concept.name}</strong>
            {concept.recommended ? <small>Recommended</small> : null}
          </button>
        ))}
      </section>

      <section className={styles.reviewStrip}>
        <div>
          <span className={styles.labEyebrow}>{selectedConcept.number} · {selectedConcept.name}</span>
          <h2>{selectedConcept.philosophy}</h2>
        </div>
        <div className={styles.reviewControls}>
          <span>Preview:</span>
          <ViewTabs value={view} onChange={(next) => {
            setView(next);
            setDecision('pending');
          }} />
        </div>
      </section>

      <section className={styles.prototypeFrame}>
        <div className={styles.browserBar}>
          <span /><span /><span />
          <div>mission-control.local / design-review / {conceptId}</div>
          <strong>Protected preview</strong>
        </div>
        {conceptId === 'command' ? <CommandCentre {...conceptProps} /> : null}
        {conceptId === 'workspace' ? <ConversationWorkspace {...conceptProps} /> : null}
        {conceptId === 'voice' ? <VoiceFirst {...conceptProps} /> : null}
      </section>

      <section className={styles.conceptRationale}>
        <article>
          <span className={styles.labEyebrow}>Design philosophy</span>
          <p>{selectedConcept.philosophy}</p>
          <strong>Why it suits Mission Control</strong>
          <p>{selectedConcept.suitability}</p>
        </article>
        <article>
          <span className={styles.labEyebrow}>Strengths</span>
          <ul>{selectedConcept.strengths.map((item) => <li key={item}>{item}</li>)}</ul>
        </article>
        <article>
          <span className={styles.labEyebrow}>Weaknesses</span>
          <ul>{selectedConcept.weaknesses.map((item) => <li key={item}>{item}</li>)}</ul>
        </article>
        <article className={styles.recommendationNote}>
          <span className={styles.labEyebrow}>Product recommendation</span>
          <h3>Use Conversation Workspace as the foundation.</h3>
          <p>Bring in Command Centre’s calm morning view and Voice-first’s persona and mobile interaction patterns.</p>
        </article>
      </section>
    </main>
  );
}
