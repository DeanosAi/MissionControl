import { baseState } from "./seed.js";
import { validateState } from "./calculations.js";
import { activateProfile, ensureHousehold, syncActiveProfile } from "./profiles.js";

export const STORAGE_KEY = "brady-budget-state-v3";
const LEGACY_STORAGE_KEY = "harbour-budget-state-v1";
const ACTIVE_PROFILE_KEY = "brady-budget-active-profile";
const STATE_ENDPOINT = "/api/budget/state";
const EVENTS_ENDPOINT = "/api/budget/events";

const remote = {
  ready: false,
  revision: 0,
  baseState: null,
  queuedState: null,
  saving: false,
  saveTimer: null,
  retryTimer: null,
  eventSource: null,
  pollTimer: null,
  clientId: sessionStorage.getItem("brady-budget-client-id") || globalThis.crypto?.randomUUID?.() || `client-${Date.now()}-${Math.random()}`,
  account: null,
  status: "connecting",
  onState: null,
  onStatus: null,
};

sessionStorage.setItem("brady-budget-client-id", remote.clientId);

function clone(value) {
  return value == null ? value : structuredClone(value);
}

function equal(first, second) {
  return JSON.stringify(first) === JSON.stringify(second);
}

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isEntityArray(value) {
  return Array.isArray(value) && value.every((item) => isRecord(item) && typeof item.id === "string");
}

export function mergeBudgetStates(base, local, server) {
  if (equal(local, base)) return clone(server);
  if (equal(server, base)) return clone(local);
  if (equal(local, server)) return clone(local);

  if (isEntityArray(local) && isEntityArray(server) && (isEntityArray(base) || !Array.isArray(base))) {
    const baseMap = new Map((Array.isArray(base) ? base : []).map((item) => [item.id, item]));
    const localMap = new Map(local.map((item) => [item.id, item]));
    const serverMap = new Map(server.map((item) => [item.id, item]));
    const order = [...server.map((item) => item.id), ...local.map((item) => item.id)]
      .filter((id, index, ids) => ids.indexOf(id) === index);

    return order.flatMap((id) => {
      const baseItem = baseMap.get(id);
      const localItem = localMap.get(id);
      const serverItem = serverMap.get(id);
      if (baseItem && !localItem) return [];
      if (baseItem && !serverItem) return localItem && !equal(localItem, baseItem) ? [clone(localItem)] : [];
      if (!localItem) return serverItem ? [clone(serverItem)] : [];
      if (!serverItem) return [clone(localItem)];
      return [mergeBudgetStates(baseItem, localItem, serverItem)];
    });
  }

  if (Array.isArray(local) && Array.isArray(server)) return clone(local);
  if (isRecord(local) && isRecord(server)) {
    const merged = {};
    const keys = new Set([
      ...Object.keys(isRecord(base) ? base : {}),
      ...Object.keys(local),
      ...Object.keys(server),
    ]);
    for (const key of keys) {
      const value = mergeBudgetStates(isRecord(base) ? base[key] : undefined, local[key], server[key]);
      if (value !== undefined) merged[key] = value;
    }
    return merged;
  }
  return clone(local);
}

function setStatus(status) {
  remote.status = status;
  remote.onStatus?.(status, remote.account);
}

function storeLocal(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function normaliseCanonicalState(candidate) {
  validateState(candidate);
  const merged = ensureHousehold({ ...baseState(), ...candidate, household: candidate.household || null });
  return activateProfile(merged, merged.household.activeProfileId, { syncCurrent: false });
}

function applyDeviceProfile(candidate) {
  const preferredId = localStorage.getItem(ACTIVE_PROFILE_KEY);
  const available = candidate.household.profiles.some((profile) => profile.id === preferredId);
  const profileId = available ? preferredId : candidate.household.activeProfileId;
  localStorage.setItem(ACTIVE_PROFILE_KEY, profileId);
  return activateProfile(candidate, profileId, { syncCurrent: false });
}

function stateForRemote(candidate) {
  const synced = syncActiveProfile(candidate);
  const canonicalId = remote.baseState?.household?.activeProfileId || synced.household.profiles[0].id;
  return activateProfile(synced, canonicalId, { syncCurrent: false });
}

export function loadState() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!stored) return baseState();
    const canonical = normaliseCanonicalState(JSON.parse(stored));
    if (!localStorage.getItem(ACTIVE_PROFILE_KEY)) {
      localStorage.setItem(ACTIVE_PROFILE_KEY, canonical.household.activeProfileId);
    }
    return applyDeviceProfile(canonical);
  } catch (error) {
    console.warn("Could not load Brady Budget data", error);
    return baseState();
  }
}

function scheduleRemoteSave(state) {
  remote.queuedState = clone(stateForRemote(state));
  if (!remote.ready) return;
  clearTimeout(remote.saveTimer);
  remote.saveTimer = setTimeout(flushRemoteSave, 140);
}

export function saveState(state) {
  const synced = syncActiveProfile(state);
  const next = {
    ...synced,
    meta: { ...synced.meta, updatedAt: new Date().toISOString() },
  };
  localStorage.setItem(ACTIVE_PROFILE_KEY, next.household.activeProfileId);
  storeLocal(next);
  scheduleRemoteSave(next);
  return next;
}

async function parseStateResponse(response) {
  if (response.status === 401) {
    location.replace("/budget/login");
    throw new Error("Sign-in required.");
  }
  const payload = await response.json();
  if (!response.ok && response.status !== 409) {
    throw new Error(payload.error || "Brady Budget could not sync.");
  }
  return payload;
}

async function flushRemoteSave() {
  if (!remote.ready || remote.saving || !remote.queuedState) return;
  clearTimeout(remote.retryTimer);
  const stateToSave = clone(remote.queuedState);
  const mergeBase = clone(remote.baseState);
  remote.queuedState = null;
  remote.saving = true;
  setStatus("saving");

  try {
    const response = await fetch(STATE_ENDPOINT, {
      method: "PUT",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        state: stateToSave,
        baseRevision: remote.revision,
        clientId: remote.clientId,
      }),
    });
    const payload = await parseStateResponse(response);
    remote.account = payload.account || remote.account;

    if (response.status === 409) {
      const latestLocal = remote.queuedState || stateToSave;
      const canonicalServer = normaliseCanonicalState(payload.state);
      const merged = normaliseCanonicalState(mergeBudgetStates(mergeBase, latestLocal, canonicalServer));
      remote.revision = Number(payload.revision);
      remote.baseState = clone(canonicalServer);
      remote.queuedState = clone(merged);
      const deviceState = applyDeviceProfile(merged);
      storeLocal(deviceState);
      remote.onState?.(deviceState, { source: "merge" });
    } else {
      remote.revision = Number(payload.revision);
      remote.baseState = clone(normaliseCanonicalState(payload.state));
    }
    setStatus("live");
  } catch (error) {
    console.warn("Brady Budget sync was delayed", error);
    remote.queuedState ||= stateToSave;
    setStatus("offline");
    remote.retryTimer = setTimeout(flushRemoteSave, 4_000);
  } finally {
    remote.saving = false;
    if (remote.queuedState && remote.status !== "offline") queueMicrotask(flushRemoteSave);
  }
}

async function refreshRemoteState() {
  const response = await fetch(STATE_ENDPOINT, { credentials: "same-origin", cache: "no-store" });
  const payload = await parseStateResponse(response);
  remote.account = payload.account || remote.account;
  const rawServerState = payload.state;
  const serverState = rawServerState ? normaliseCanonicalState(rawServerState) : null;
  const normalisedServerChanged = Boolean(
    rawServerState
    && rawServerState.household?.shopping?.weekKey !== serverState.household.shopping.weekKey,
  );
  const revision = Number(payload.revision);

  if (!serverState) {
    remote.revision = revision;
    remote.baseState = null;
    remote.ready = true;
    remote.queuedState ||= stateForRemote(loadState());
    await flushRemoteSave();
    return;
  }

  if (remote.queuedState || remote.saving) {
    const latestLocal = remote.queuedState || stateForRemote(loadState());
    const merged = normaliseCanonicalState(mergeBudgetStates(remote.baseState, latestLocal, serverState));
    remote.revision = revision;
    remote.baseState = clone(serverState);
    remote.queuedState = clone(merged);
    const deviceState = applyDeviceProfile(merged);
    storeLocal(deviceState);
    remote.onState?.(deviceState, { source: "merge" });
  } else if (revision !== remote.revision || !remote.baseState || normalisedServerChanged) {
    remote.revision = revision;
    remote.baseState = clone(serverState);
    const deviceState = applyDeviceProfile(serverState);
    storeLocal(deviceState);
    remote.onState?.(deviceState, { source: "remote" });
    if (normalisedServerChanged) remote.queuedState = clone(serverState);
  }
  remote.ready = true;
  setStatus("live");
  if (remote.queuedState) queueMicrotask(flushRemoteSave);
}

function connectEvents() {
  remote.eventSource?.close();
  const events = new EventSource(EVENTS_ENDPOINT);
  remote.eventSource = events;
  events.addEventListener("connected", () => setStatus("live"));
  events.addEventListener("budget-update", async (event) => {
    const update = JSON.parse(event.data);
    if (update.clientId === remote.clientId || Number(update.revision) <= remote.revision) return;
    try {
      await refreshRemoteState();
      remote.onStatus?.("updated", remote.account);
    } catch (error) {
      console.warn("Could not apply a household update", error);
    }
  });
  events.onerror = () => setStatus("reconnecting");
}

export async function initialiseRemoteSync({ onState, onStatus } = {}) {
  remote.onState = onState || null;
  remote.onStatus = onStatus || null;
  setStatus("connecting");
  try {
    await refreshRemoteState();
    remote.ready = true;
    connectEvents();
    clearInterval(remote.pollTimer);
    remote.pollTimer = setInterval(() => refreshRemoteState().catch(() => setStatus("reconnecting")), 3_000);
  } catch (error) {
    console.warn("Brady Budget is using its offline copy", error);
    setStatus("offline");
  }
}

export function getRemoteAccount() {
  return remote.account;
}

export function getRemoteStatus() {
  return remote.status;
}

export function clearState() {
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(LEGACY_STORAGE_KEY);
  localStorage.removeItem(ACTIVE_PROFILE_KEY);
}

export function stateSize(state) {
  return new Blob([JSON.stringify(state)]).size;
}

export function downloadFile(name, content, type = "application/json") {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function transactionsToCSV(transactions) {
  const escape = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;
  const rows = [["Date", "Description", "Amount", "Type", "Category", "Note"]];
  for (const transaction of transactions) {
    rows.push([
      transaction.date,
      transaction.name,
      transaction.type === "expense" ? -Math.abs(transaction.amount) : Math.abs(transaction.amount),
      transaction.type,
      transaction.categoryId,
      transaction.note || "",
    ]);
  }
  return rows.map((row) => row.map(escape).join(",")).join("\n");
}
