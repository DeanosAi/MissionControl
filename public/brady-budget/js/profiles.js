export const PROFILE_LIMIT = 2;
export const PROFILE_COLOURS = ["#d7f15c", "#ff8f70"];

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
  let items = Array.isArray(shopping?.items)
    ? shopping.items.map((item) => ({ ...item, recurring: Boolean(item.recurring) }))
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
    items,
  };
}

function cloneList(list = []) {
  return list.map((item) => ({ ...item }));
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
  return hydrated;
}

export function activeProfileRecord(state) {
  return state.household?.profiles?.find((profile) => profile.id === state.household.activeProfileId) || null;
}
