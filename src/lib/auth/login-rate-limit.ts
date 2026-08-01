import 'server-only';

interface AttemptWindow {
  count: number;
  resetAt: number;
}

declare global {
  var __missionControlLoginAttempts__: Map<string, AttemptWindow> | undefined;
}

const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 8;

function attempts() {
  globalThis.__missionControlLoginAttempts__ ??= new Map<string, AttemptWindow>();
  return globalThis.__missionControlLoginAttempts__;
}

export function canAttemptLogin(key: string): boolean {
  const now = Date.now();
  const current = attempts().get(key);
  if (!current || current.resetAt <= now) {
    attempts().delete(key);
    return true;
  }
  return current.count < MAX_ATTEMPTS;
}

export function recordFailedLogin(key: string): void {
  const now = Date.now();
  const current = attempts().get(key);
  if (!current || current.resetAt <= now) {
    attempts().set(key, { count: 1, resetAt: now + WINDOW_MS });
    return;
  }
  current.count += 1;
}

export function clearLoginAttempts(key: string): void {
  attempts().delete(key);
}

