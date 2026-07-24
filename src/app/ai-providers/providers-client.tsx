'use client';

import { useMemo, useState, useTransition } from 'react';

import type { AIProviderRecord } from '@/lib/ai-providers/types';
import type { LocalModelRecord } from '@/lib/local-llm/client';
import { DigitalPersona } from '@/components/digital-persona';
import { LocalModelsClient } from '@/app/local-models/local-models-client';
import {
  removeProviderCredentialAction,
  saveProviderCredentialAction,
  setProviderEnabledAction,
  testProviderConnectionAction,
  updateProviderPreferencesAction,
  type ProviderActionResult,
} from './actions';
import styles from './providers.module.css';

function relativeTime(value: string | null): string {
  if (!value) return 'Never';
  const elapsed = Date.now() - new Date(value).getTime();
  const minutes = Math.max(0, Math.floor(elapsed / 60_000));
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function healthLabel(provider: AIProviderRecord): string {
  if (!provider.enabled) return 'Disabled';
  if (!provider.credentialConfigured && provider.id !== 'local') return 'Needs connection';
  return provider.healthStatus === 'unknown'
    ? 'Not tested'
    : provider.healthStatus.charAt(0).toUpperCase() + provider.healthStatus.slice(1);
}

export function AIProvidersClient({
  initialProviders,
  credentialStorageEnabled: initialStorageEnabled,
  initialLocalModels,
  lmStudioDetected,
  lmStudioModels,
}: {
  initialProviders: AIProviderRecord[];
  credentialStorageEnabled: boolean;
  initialLocalModels: LocalModelRecord[];
  lmStudioDetected: boolean;
  lmStudioModels: string[];
}) {
  const [providers, setProviders] = useState(initialProviders);
  const [selectedId, setSelectedId] = useState(initialProviders[0]?.id ?? 'openai');
  const [credentialStorageEnabled, setCredentialStorageEnabled] = useState(initialStorageEnabled);
  const [apiKey, setApiKey] = useState('');
  const [priorityWeight, setPriorityWeight] = useState(
    initialProviders[0]?.priorityWeight ?? 50,
  );
  const [preferredUsage, setPreferredUsage] = useState(
    initialProviders[0]?.preferredUsage ?? '',
  );
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const selected = useMemo(
    () => providers.find((provider) => provider.id === selectedId) ?? providers[0],
    [providers, selectedId],
  );

  function applyResult(result: ProviderActionResult) {
    if (result.providers) setProviders(result.providers);
    if (typeof result.credentialStorageEnabled === 'boolean') {
      setCredentialStorageEnabled(result.credentialStorageEnabled);
    }
    if (result.error) setFeedback({ type: 'error', text: result.error });
    else if (result.message) setFeedback({ type: 'success', text: result.message });
  }

  function chooseProvider(provider: AIProviderRecord) {
    setSelectedId(provider.id);
    setPriorityWeight(provider.priorityWeight);
    setPreferredUsage(provider.preferredUsage);
    setApiKey('');
    setFeedback(null);
  }

  if (!selected) {
    return <section className="card"><p>No AI providers are registered.</p></section>;
  }

  return (
    <section className={styles.page}>
      <header className={styles.intro}>
        <div className={styles.introPersona}>
          <DigitalPersona state="greeting" size="medium" />
        </div>
        <div>
          <span className={styles.eyebrow}>Provider-agnostic by design</span>
          <h2>One assistant. Replaceable capabilities underneath.</h2>
          <p>
            Mission Control weighs capability, cost, speed, reliability, privacy, context,
            availability, and recent outcomes. Provider names remain visible for trust—not management burden.
          </p>
        </div>
        <div className={styles.summaryStats}>
          <div><strong>{providers.filter((provider) => provider.enabled).length}</strong><span>enabled</span></div>
          <div><strong>{providers.filter((provider) => provider.healthStatus === 'healthy').length}</strong><span>healthy</span></div>
          <div><strong>{new Set(providers.flatMap((provider) => provider.capabilities)).size}</strong><span>capabilities</span></div>
        </div>
      </header>

      {!credentialStorageEnabled ? (
        <div className={styles.storageNotice} role="status">
          <strong>Encrypted credential storage is not configured.</strong>
          <span>Environment-backed providers continue working. Add `PROVIDER_CREDENTIALS_KEY` before saving credentials here.</span>
        </div>
      ) : null}

      <div className={styles.layout}>
        <div className={styles.providerList} aria-label="Configured AI providers">
          {providers.map((provider) => (
            <article
              className={`${styles.providerCard} ${provider.id === selected.id ? styles.providerCardSelected : ''}`}
              key={provider.id}
            >
              <button type="button" className={styles.providerSelect} onClick={() => chooseProvider(provider)}>
                <span className={`${styles.monogram} ${styles[`monogram_${provider.id}`]}`}>
                  {provider.displayName.slice(0, 2)}
                </span>
                <span className={styles.providerIdentity}>
                  <strong>{provider.displayName}</strong>
                  <small>
                    <i className={`${styles.healthDot} ${styles[`health_${provider.healthStatus}`]}`} />
                    {healthLabel(provider)}
                  </small>
                </span>
                <span className={styles.capabilityCount}>{provider.modelCount} models</span>
              </button>
              <button
                type="button"
                role="switch"
                aria-checked={provider.enabled}
                aria-label={`${provider.enabled ? 'Disable' : 'Enable'} ${provider.displayName}`}
                className={`${styles.toggle} ${provider.enabled ? styles.toggleOn : ''}`}
                disabled={pending}
                onClick={() => startTransition(async () => {
                  applyResult(await setProviderEnabledAction(provider.id, !provider.enabled));
                })}
              >
                <i />
              </button>
            </article>
          ))}
        </div>

        <article className={styles.detail}>
          <header className={styles.detailHeader}>
            <span className={`${styles.monogram} ${styles[`monogram_${selected.id}`]}`}>
              {selected.displayName.slice(0, 2)}
            </span>
            <div>
              <span className={styles.eyebrow}>Provider profile</span>
              <h3>{selected.displayName}</h3>
              <p>{selected.preferredUsage}</p>
            </div>
            <span className={`${styles.healthBadge} ${styles[`healthBadge_${selected.healthStatus}`]}`}>
              {healthLabel(selected)}
            </span>
          </header>

          <div className={styles.factGrid}>
            <div><span>Connection</span><strong>{selected.credentialConfigured ? 'Configured' : 'Not configured'}</strong></div>
            <div><span>Credential</span><strong>{selected.credentialFingerprint ? `Encrypted · ${selected.credentialFingerprint}` : selected.credentialSource}</strong></div>
            <div><span>Last successful call</span><strong>{relativeTime(selected.lastSuccessfulCallAt)}</strong></div>
            <div><span>Estimated pricing</span><strong>{selected.estimatedPricing}</strong></div>
          </div>

          <section className={styles.recommendation}>
            <span className={styles.eyebrow}>Why Mission Control uses it</span>
            <p>{selected.preferredUsage}</p>
            <div className={styles.capabilityCloud}>
              {selected.capabilities.map((capability) => <span key={capability}>{capability}</span>)}
            </div>
          </section>

          <div className={styles.tradeoffGrid}>
            <section>
              <h4>Strengths</h4>
              <ul>{selected.strengths.map((item) => <li key={item}>{item}</li>)}</ul>
            </section>
            <section>
              <h4>Weaknesses</h4>
              <ul>{selected.weaknesses.map((item) => <li key={item}>{item}</li>)}</ul>
            </section>
            <section className={styles.privacySection}>
              <h4>Privacy implications</h4>
              <p>{selected.privacyNotes}</p>
            </section>
          </div>

          <section className={styles.preferenceForm}>
            <div>
              <label htmlFor="provider-priority">Priority weighting</label>
              <div className={styles.rangeRow}>
                <input
                  id="provider-priority"
                  type="range"
                  min="0"
                  max="100"
                  value={priorityWeight}
                  onChange={(event) => setPriorityWeight(Number(event.target.value))}
                />
                <strong>{priorityWeight}/100</strong>
              </div>
              <small>A routing signal—not a forced provider choice.</small>
            </div>
            <label>
              <span>Preferred usage</span>
              <textarea
                rows={3}
                maxLength={500}
                value={preferredUsage}
                onChange={(event) => setPreferredUsage(event.target.value)}
              />
            </label>
            <button
              type="button"
              className={styles.secondaryButton}
              disabled={pending}
              onClick={() => startTransition(async () => {
                applyResult(await updateProviderPreferencesAction({
                  providerId: selected.id,
                  priorityWeight,
                  preferredUsage,
                }));
              })}
            >
              Save routing preferences
            </button>
          </section>

          {selected.id === 'local' ? (
            <div className={styles.localModelsPanel}>
              <LocalModelsClient
                initialModels={initialLocalModels}
                lmStudioDetected={lmStudioDetected}
                lmStudioModels={lmStudioModels}
              />
            </div>
          ) : null}

          {selected.connectionMode !== 'local' ? (
            <details className={styles.credentialPanel}>
              <summary>Manage API credential <span>{selected.credentialConfigured ? 'Configured' : 'Required'}</span></summary>
              <div>
                <p>
                  Credentials are write-only and encrypted before storage. They are never returned to this page,
                  written to the Journal, or included in model prompts.
                </p>
                <label>
                  <span>New API key</span>
                  <input
                    type="password"
                    autoComplete="new-password"
                    value={apiKey}
                    disabled={!credentialStorageEnabled || pending}
                    onChange={(event) => setApiKey(event.target.value)}
                    placeholder="Paste a new key to replace the current credential"
                  />
                </label>
                <div className={styles.credentialActions}>
                  <button
                    type="button"
                    className={styles.primaryButton}
                    disabled={!credentialStorageEnabled || pending || apiKey.trim().length < 8}
                    onClick={() => startTransition(async () => {
                      const result = await saveProviderCredentialAction(selected.id, apiKey);
                      applyResult(result);
                      if (!result.error) setApiKey('');
                    })}
                  >
                    Encrypt and save
                  </button>
                  {selected.credentialFingerprint ? (
                    <button
                      type="button"
                      className={styles.dangerButton}
                      disabled={pending}
                      onClick={() => startTransition(async () => {
                        applyResult(await removeProviderCredentialAction(selected.id));
                      })}
                    >
                      Remove stored credential
                    </button>
                  ) : null}
                </div>
              </div>
            </details>
          ) : null}

          <footer className={styles.detailFooter}>
            <div>
              <span>Connection test</span>
              <small>Hosted providers may make a minimal paid call. This never changes routing automatically.</small>
            </div>
            <button
              type="button"
              className={styles.primaryButton}
              disabled={pending || !selected.enabled}
              onClick={() => startTransition(async () => {
                applyResult(await testProviderConnectionAction(selected.id));
              })}
            >
              {pending ? 'Checking…' : 'Test connection'}
            </button>
          </footer>

          {feedback ? (
            <p className={feedback.type === 'error' ? styles.feedbackError : styles.feedbackSuccess} role="status">
              {feedback.text}
            </p>
          ) : null}
        </article>
      </div>
    </section>
  );
}
