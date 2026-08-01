import { normaliseStoreId } from "./pricing.js";

export const PROFILE_LIMIT = 2;
export const PROFILE_COLOURS = ["#d7f15c", "#ff8f70"];
export const DEFAULT_CATEGORY_GROUPS = [
  { id: "fixed", label: "Fixed costs", note: "Protected first", colour: "#79b8be", custom: false },
  { id: "everyday", label: "Everyday spending", note: "Flexible spending", colour: "#ff8f70", custom: false },
  { id: "future", label: "Future & irregular", note: "Build a buffer", colour: "#9184c8", custom: false },
];

const LIST_KEYS = ["categories", "transactions", "bills", "goals", "accounts"];

export function shoppingWeekKey(date = new Date()) {
  const weekStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = weekStart.getDay();
  weekStart.setDate(weekStart.getDate() - (day === 0 ? 6 : day - 1));
  const year = weekStart.getFullYear();
  const month = String(weekStart.getMonth() + 1).padStart(2, "0");
  const dateOfMonth = String(weekStart.getDate()).padStart(2, "0");
  return `${year}-${month}-${dateOfMonth}`;
}

function normaliseShopping(shopping) {
  const currentWeek = shoppingWeekKey();
  const previousWeek = shopping?.weekKey || currentWeek;
  const storeId = normaliseStoreId(shopping?.storeId);
  let items = Array.isArray(shopping?.items)
    ? shopping.items.map((item) => ({
      ...item,
      recurring: Boolean(item.recurring),
      storeId: normaliseStoreId(item.storeId || storeId),
      priceSource: item.priceSource || (Number(item.estimatedCost) > 0 ? "manual" : "fallback"),
    }))
    : [];
  if (previousWeek !== currentWeek) {
    items = items
      .filter((item) => item.recurring || !item.checked)
      .map((item) => ({
        ...item,
        checked: item.recurring ? false : Boolean(item.checked),
        weekAdded: item.recurring ? currentWeek : item.weekAdded || previousWeek,
      }));
  }
  return {
    budget: Math.max(0, Number(shopping?.budget) || 0),
    weekKey: currentWeek,
    storeId,
    priceMemory: shopping?.priceMemory && typeof shopping.priceMemory === "object" ? shopping.priceMemory : {},
    items,
  };
}

function cloneList(list = []) {
  return list.map((item) => ({ ...item }));
}

export function normaliseCategoryGroups(groups = [], categories = []) {
  const supplied = Array.isArray(groups) ? groups : [];
  const merged = DEFAULT_CATEGORY_GROUPS.map((fallback) => ({
    ...fallback,
    ...(supplied.find((group) => group?.id === fallback.id) || {}),
    custom: false,
  }));
  for (const group of supplied) {
    if (!group?.id || merged.some((item) => item.id === group.id)) continue;
    merged.push({
      id: String(group.id),
      label: String(group.label || "My group"),
      note: String(group.note || "My spending group"),
      colour: String(group.colour || "#d7f15c"),
      custom: true,
    });
  }
  for (const category of Array.isArray(categories) ? categories : []) {
    if (!category?.group || merged.some((group) => group.id === category.group)) continue;
    merged.push({ id: category.group, label: "My group", note: "My spending group", colour: category.colour || "#d7f15c", custom: true });
  }
  return merged;
}

export function createProfileRecord(budgetState, options = {}) {
  const id = options.id || `profile-${Date.now()}`;
  const name = options.name || budgetState.profile?.name || "Profile";
  return {
    id,
    name,
    colour: options.colour || PROFILE_COLOURS[0],
    createdAt: options.createdAt || new Date().toISOString(),
    profile: { ...budgetState.profile, name },
    currentMonth: budgetState.currentMonth,
    categories: cloneList(budgetState.categories),
    categoryGroups: cloneList(normaliseCategoryGroups(budgetState.categoryGroups, budgetState.categories)),
    transactions: cloneList(budgetState.transactions),
    bills: cloneList(budgetState.bills),
    goals: cloneList(budgetState.goals),
    accounts: cloneList(budgetState.accounts),
  };
}

export function ensureHousehold(state) {
  if (state.household?.profiles?.length) {
    const activeId = state.household.activeProfileId || state.household.profiles[0].id;
    const household = { ...state.household, shopping: normaliseShopping(state.household.shopping) };
    return activateProfile({ ...state, version: 2, household }, activeId, { syncCurrent: false });
  }

  const primary = createProfileRecord(state, {
    id: "profile-primary",
    name: state.profile?.name || "My budget",
    colour: PROFILE_COLOURS[0],
  });
  return {
    ...state,
    version: 2,
    household: {
      activeProfileId: primary.id,
      profiles: [primary],
      shopping: normaliseShopping(),
    },
  };
}

export function syncActiveProfile(state) {
  if (!state.household?.profiles?.length) return ensureHousehold(state);
  const activeId = state.household.activeProfileId;
  const index = state.household.profiles.findIndex((profile) => profile.id === activeId);
  if (index < 0) return ensureHousehold({ ...state, household: null });
  const existing = state.household.profiles[index];
  const updated = createProfileRecord(state, {
    id: existing.id,
    name: state.profile?.name || existing.name,
    colour: existing.colour,
    createdAt: existing.createdAt,
  });
  const profiles = state.household.profiles.map((profile, profileIndex) => profileIndex === index ? updated : profile);
  return { ...state, version: 2, household: { ...state.household, profiles } };
}

export function activateProfile(state, profileId, options = {}) {
  const source = options.syncCurrent === false ? state : syncActiveProfile(state);
  const selected = source.household?.profiles?.find((profile) => profile.id === profileId);
  if (!selected) return source;
  const hydrated = {
    ...source,
    version: 2,
    household: { ...source.household, activeProfileId: selected.id },
    profile: { ...selected.profile, name: selected.name },
    currentMonth: selected.currentMonth,
  };
  for (const key of LIST_KEYS) hydrated[key] = cloneList(selected[key]);
  hydrated.categoryGroups = normaliseCategoryGroups(selected.categoryGroups, hydrated.categories);
  return hydrated;
}

export function activeProfileRecord(state) {
  return state.household?.profiles?.find((profile) => profile.id === state.household.activeProfileId) || null;
}
