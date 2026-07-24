/**
 * Detect the known invalid provider test response that was persisted before
 * the Conversational Bridge routing fix. The record remains visible as audit
 * history, but it must never be supplied to a model as an example response.
 */
export function isLegacyInvalidAssistantMessage(content: string): boolean {
  const normalized = content.replace(/\s+/g, ' ').trim();
  return /\b2\s*\+\s*2\s*=\s*4\b/i.test(normalized)
    && /\bis there something(?: specific)? you(?:'d| would) like me to help you with\b/i.test(normalized)
    && /\bmission control\b/i.test(normalized);
}
