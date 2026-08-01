import { APP_VERSION, monthKey, shiftMonth, toLocalISO, uid } from "./calculations.js";
import { createProfileRecord, PROFILE_COLOURS, shoppingWeekKey, syncActiveProfile } from "./profiles.js";

export const CATEGORY_TEMPLATES = [
  { id: "housing", name: "Housing", icon: "🏠", group: "fixed", budget: 0, colour: "#79b8be" },
  { id: "utilities", name: "Utilities", icon: "💡", group: "fixed", budget: 0, colour: "#79b8be" },
  { id: "subscriptions", name: "Subscriptions", icon: "📺", group: "fixed", budget: 0, colour: "#79b8be" },
  { id: "transport", name: "Transport", icon: "🚗", group: "fixed", budget: 0, colour: "#79b8be" },
  { id: "groceries", name: "Groceries", icon: "🛒", group: "everyday", budget: 0, colour: "#ff8f70" },
  { id: "eating-out", name: "Eating out", icon: "🍜", group: "everyday", budget: 0, colour: "#ff8f70" },
  { id: "shopping", name: "Shopping", icon: "🛍️", group: "everyday", budget: 0, colour: "#ff8f70" },
  { id: "fun", name: "Fun money", icon: "🎟️", group: "everyday", budget: 0, colour: "#ff8f70" },
  { id: "health", name: "Health", icon: "🧘", group: "future", budget: 0, colour: "#9184c8" },
  { id: "giving", name: "Gifts & giving", icon: "🎁", group: "future", budget: 0, colour: "#9184c8" },
  { id: "buffer", name: "Buffer", icon: "☂️", group: "future", budget: 0, colour: "#9184c8" },
  { id: "uncategorised", name: "Uncategorised", icon: "•", group: "everyday", budget: 0, colour: "#748886" },
];

export function baseState() {
  const state = {
    version: APP_VERSION,
    profile: {
      name: "",
      currency: "AUD",
      monthlyIncome: 0,
      payCadence: "fortnightly",
      theme: "system",
      onboarded: false,
      demoMode: false,
    },
    currentMonth: monthKey(),
    categories: CATEGORY_TEMPLATES.map((category) => ({ ...category })),
    transactions: [],
    bills: [],
    goals: [],
    accounts: [],
    preferences: { installedPromptDismissed: false },
    meta: { createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  };
  const primary = createProfileRecord(state, { id: "profile-primary", name: "My budget", colour: PROFILE_COLOURS[0] });
  state.household = { activeProfileId: primary.id, profiles: [primary], shopping: { budget: 0, weekKey: shoppingWeekKey(), items: [] } };
  return state;
}

export function applyTemplate(state, style = "balanced") {
  const income = Number(state.profile.monthlyIncome) || 0;
  const weights = style === "simple"
    ? { housing: 0.3, utilities: 0.07, transport: 0.08, groceries: 0.12, "eating-out": 0.05, shopping: 0.04, fun: 0.04, health: 0.03, giving: 0.02, buffer: 0.05 }
    : { housing: 0.28, utilities: 0.06, subscriptions: 0.02, transport: 0.08, groceries: 0.11, "eating-out": 0.05, shopping: 0.04, fun: 0.04, health: 0.03, giving: 0.02, buffer: 0.07 };
  return {
    ...state,
    categories: state.categories.map((category) => ({
      ...category,
      budget: style === "blank" ? 0 : Math.round((weights[category.id] || 0) * income / 10) * 10,
    })),
  };
}

function dateInCurrentMonth(day) {
  const key = monthKey();
  const [year, month] = key.split("-").map(Number);
  const safeDay = Math.min(day, new Date(year, month, 0).getDate());
  return `${key}-${String(safeDay).padStart(2, "0")}`;
}

function upcomingDate(dayOffset) {
  const date = new Date();
  date.setDate(date.getDate() + dayOffset);
  return toLocalISO(date);
}

export function demoState() {
  const state = baseState();
  const income = 6800;
  const budgetValues = {
    housing: 2350,
    utilities: 310,
    subscriptions: 95,
    transport: 420,
    groceries: 760,
    "eating-out": 360,
    shopping: 240,
    fun: 280,
    health: 180,
    giving: 100,
    buffer: 300,
  };
  state.profile = { ...state.profile, name: "Dean", monthlyIncome: income, onboarded: true, demoMode: true };
  state.categories = state.categories.map((category) => ({ ...category, budget: budgetValues[category.id] || 0 }));
  state.goals = [
    { id: "goal-emergency", name: "Emergency fund", icon: "🛟", target: 15000, saved: 8200, monthlyContribution: 650, targetDate: shiftMonth(monthKey(), 11) + "-01", colour: "#9184c8" },
    { id: "goal-holiday", name: "Japan holiday", icon: "🗻", target: 6500, saved: 2950, monthlyContribution: 400, targetDate: shiftMonth(monthKey(), 9) + "-01", colour: "#ff8f70" },
    { id: "goal-car", name: "Next car", icon: "🚙", target: 18000, saved: 4300, monthlyContribution: 300, targetDate: shiftMonth(monthKey(), 24) + "-01", colour: "#79b8be" },
  ];
  state.bills = [
    { id: "bill-rent", name: "Rent", amount: 2350, nextDue: upcomingDate(3), frequency: "monthly", categoryId: "housing", active: true, autopay: true },
    { id: "bill-energy", name: "Energy", amount: 145, nextDue: upcomingDate(7), frequency: "monthly", categoryId: "utilities", active: true, autopay: true },
    { id: "bill-mobile", name: "Mobile plan", amount: 55, nextDue: upcomingDate(12), frequency: "monthly", categoryId: "utilities", active: true, autopay: true },
    { id: "bill-stream", name: "Streaming", amount: 24.99, nextDue: upcomingDate(16), frequency: "monthly", categoryId: "subscriptions", active: true, autopay: true },
  ];
  const currentDay = new Date().getDate();
  const day = (offset) => Math.max(1, currentDay - offset);
  state.transactions = [
    { id: uid("txn"), date: dateInCurrentMonth(1), name: "Salary", amount: 3400, type: "income", categoryId: "", note: "Fortnightly pay", cleared: true },
    { id: uid("txn"), date: dateInCurrentMonth(day(0)), name: "Woolworths", amount: 126.4, type: "expense", categoryId: "groceries", note: "", cleared: true },
    { id: uid("txn"), date: dateInCurrentMonth(day(1)), name: "Opal top up", amount: 50, type: "expense", categoryId: "transport", note: "", cleared: true },
    { id: uid("txn"), date: dateInCurrentMonth(day(2)), name: "The Grounds", amount: 42.8, type: "expense", categoryId: "eating-out", note: "", cleared: true },
    { id: uid("txn"), date: dateInCurrentMonth(day(3)), name: "Chemist Warehouse", amount: 31.95, type: "expense", categoryId: "health", note: "", cleared: true },
    { id: uid("txn"), date: dateInCurrentMonth(day(4)), name: "Coles", amount: 89.7, type: "expense", categoryId: "groceries", note: "", cleared: true },
    { id: uid("txn"), date: dateInCurrentMonth(day(5)), name: "Spotify", amount: 13.99, type: "expense", categoryId: "subscriptions", note: "", cleared: true },
    { id: uid("txn"), date: dateInCurrentMonth(day(6)), name: "Hoyts", amount: 38, type: "expense", categoryId: "fun", note: "", cleared: true },
  ];
  return syncActiveProfile(state);
}
