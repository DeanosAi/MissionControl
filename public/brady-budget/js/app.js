import {
  advanceBillDate,
  calculateBudget,
  calculateShoppingList,
  clamp,
  formatCurrency,
  formatDate,
  goalProjection,
  monthKey,
  normalizeIncome,
  normalisePeriodSelection,
  parseBankCSV,
  parseLocalDate,
  periodBounds,
  periodLabel,
  periodNoun,
  periodTitle,
  recurringAmountForPeriod,
  scaleMonthlyAmount,
  splitBillAmount,
  toLocalISO,
  transactionsForPeriod,
  uid,
  upcomingBills,
  validateState,
} from "./calculations.js";
import { applyTemplate, baseState, demoState } from "./seed.js";
import {
  activateProfile,
  activeProfileRecord,
  createProfileRecord,
  ensureHousehold,
  PROFILE_COLOURS,
  PROFILE_LIMIT,
  syncActiveProfile,
} from "./profiles.js";
import {
  clearState,
  downloadFile,
  getRemoteAccount,
  getRemoteStatus,
  initialiseRemoteSync,
  loadState,
  saveState,
  STORAGE_KEY,
  stateSize,
  transactionsToCSV,
} from "./storage.js";
import {
  estimateShoppingPrice,
  normaliseStoreId,
  rememberShoppingPrice,
  SHOPPING_STORES,
  storeLabel,
  suggestShoppingProducts,
} from "./pricing.js";

const NAV_ITEMS = [
  { id: "overview", label: "Overview", icon: "home" },
  { id: "plan", label: "Plan", icon: "plan" },
  { id: "activity", label: "Activity", icon: "activity" },
  { id: "goals", label: "Goals", icon: "goal" },
  { id: "shopping", label: "Shopping", icon: "cart" },
  { id: "more", label: "More", icon: "more" },
];

const PAGE_TITLES = {
  overview: "Overview",
  plan: "Plan",
  activity: "Activity",
  goals: "Savings goals",
  shopping: "Shopping list",
  more: "More",
};

const SYNC_LABELS = {
  connecting: "Connecting",
  saving: "Saving changes",
  live: "Live on both phones",
  updated: "Household updated",
  reconnecting: "Reconnecting",
  offline: "Offline — changes queued",
};

const HOUSEHOLD_NOTICE_DISMISSED_KEY = "brady-budget:household-notice-dismissed";
const VIEW_PERIOD_STORAGE_KEY = "brady-budget:view-period-v1";

const GROUPS = {
  fixed: { label: "Fixed costs", note: "Protected first", colour: "#79b8be" },
  everyday: { label: "Everyday spending", note: "Flexible spending", colour: "#ff8f70" },
  future: { label: "Future & irregular", note: "Build a buffer", colour: "#9184c8" },
};

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const money = (value, options) => formatCurrency(value, state.profile.currency, options);
const groceryMoney = (value) => money(value, { maximumFractionDigits: 2 });
const icon = (name) => `<svg aria-hidden="true"><use href="#i-${name}"></use></svg>`;

let state = loadState();
let viewPeriod = loadViewPeriod(state.currentMonth);
let onboardingStep = 0;
let pendingCSVTransactions = [];
let deferredInstallPrompt = null;

function escapeHTML(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function activeView() {
  const hash = location.hash.replace("#", "");
  return NAV_ITEMS.some((item) => item.id === hash) ? hash : "overview";
}

function loadViewPeriod(fallbackMonth = monthKey()) {
  const fallbackAnchor = fallbackMonth === monthKey() ? toLocalISO() : `${fallbackMonth}-01`;
  try {
    const stored = JSON.parse(localStorage.getItem(VIEW_PERIOD_STORAGE_KEY) || "null");
    return stored ? normalisePeriodSelection(stored, fallbackMonth) : { kind: "monthly", anchor: fallbackAnchor };
  } catch {
    return { kind: "monthly", anchor: fallbackAnchor };
  }
}

function setViewPeriod(selection) {
  viewPeriod = normalisePeriodSelection(selection, state.currentMonth);
  try {
    localStorage.setItem(VIEW_PERIOD_STORAGE_KEY, JSON.stringify(viewPeriod));
  } catch {
    // The selected view still works for this visit if device storage is unavailable.
  }
}

function selectedPeriod() {
  return periodBounds(viewPeriod);
}

function selectedPeriodAmount(monthlyAmount) {
  return scaleMonthlyAmount(monthlyAmount, viewPeriod.kind);
}

function selectedPeriodName() {
  return periodNoun(viewPeriod.kind);
}

function selectedPeriodTitle() {
  return periodTitle(viewPeriod.kind);
}

function categoryById(id) {
  return state.categories.find((category) => category.id === id);
}

function persist(message) {
  state = saveState(state);
  renderApp();
  if (message) toast(message);
}

function navMarkup(item) {
  const active = activeView() === item.id;
  return `<a class="nav-link ${active ? "active" : ""}" href="#${item.id}" data-nav="${item.id}" ${active ? 'aria-current="page"' : ""}>
    ${icon(item.icon)}<span>${item.label}</span>
  </a>`;
}

function renderNavigation() {
  $(".desktop-nav").innerHTML = NAV_ITEMS.map(navMarkup).join("");
  $(".mobile-nav").innerHTML = NAV_ITEMS.map(navMarkup).join("");
}

function applyTheme() {
  const prefersDark = matchMedia("(prefers-color-scheme: dark)").matches;
  const dark = state.profile.theme === "dark" || (state.profile.theme === "system" && prefersDark);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
  $("meta[name='theme-color']").content = dark ? "#091919" : "#102a2a";
}

function updateChrome() {
  const view = activeView();
  $("#page-title").textContent = view === "plan" ? `${selectedPeriodTitle()} plan` : PAGE_TITLES[view];
  $("#month-label").textContent = periodLabel(viewPeriod, "en-AU", true);
  $("#month-control").setAttribute("aria-label", `Choose budget period. Currently ${viewPeriod.kind}, ${periodLabel(viewPeriod)}`);
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  $("#greeting").textContent = state.profile.name ? `${greeting}, ${state.profile.name}` : greeting;
  $("#profile-initial").textContent = (state.profile.name || "H").slice(0, 1).toUpperCase();
  $("#profile-name").textContent = state.profile.name || "My budget";
  const activeProfile = activeProfileRecord(state);
  $("#profile-initial").style.background = activeProfile?.colour || PROFILE_COLOURS[0];
  $("#profile-initial").style.color = "#102a2a";
  const quickAdd = $("#quick-add");
  const quickAddViews = new Set(["overview", "activity", "shopping"]);
  quickAdd.hidden = !state.profile.onboarded || !quickAddViews.has(view);
  quickAdd.setAttribute("aria-label", view === "shopping" ? "Add shopping item" : "Add transaction");
}

function updateVisibleSyncStatus() {
  const indicator = $("#main-content .sync-indicator");
  const copy = $("#sync-status-copy");
  if (!indicator || !copy) return;
  const status = getRemoteStatus();
  const remoteAccount = getRemoteAccount();
  indicator.className = `sync-indicator ${status}`;
  copy.textContent = `${SYNC_LABELS[status] || "Connecting"}${remoteAccount ? ` · signed in as ${remoteAccount.displayName}` : ""}`;
}

function optimiseFormControls(root = document) {
  root.querySelectorAll("input[type='number']").forEach((input) => {
    input.inputMode = input.step === "1" ? "numeric" : "decimal";
  });
}

function renderApp() {
  applyTheme();
  renderNavigation();
  updateChrome();
  const view = activeView();
  const renderers = { overview: renderOverview, plan: renderPlan, activity: renderActivity, goals: renderGoals, shopping: renderShopping, more: renderMore };
  $("#main-content").innerHTML = `<div class="page-enter">${renderers[view]()}</div>`;
  if (!state.profile.onboarded) renderOnboarding();
  else $("#onboarding-root").innerHTML = "";
  optimiseFormControls($("#main-content"));
}

function renderOverview() {
  const period = selectedPeriod();
  const summary = calculateBudget(state, period);
  const safeClass = summary.safeToSpend < 0 ? "negative" : "positive";
  const recent = [...transactionsForPeriod(state.transactions, period)]
    .sort((a, b) => String(b.date).localeCompare(String(a.date)))
    .slice(0, 5);
  const bills = upcomingBills(state.bills, period.startDate, Math.max(0, period.days - 1)).slice(0, 4);
  const topCategories = [...summary.categoryRows]
    .filter((category) => category.budget > 0 || category.spent > 0)
    .sort((a, b) => b.spent - a.spent)
    .slice(0, 4);
  const plannedTotal = summary.categoryBudget + summary.goalContributions;
  const progress = summary.expectedIncome ? clamp((summary.expenseTotal / summary.expectedIncome) * 100, 0, 100) : 0;
  const setupNotice = summary.expectedIncome <= 0
    ? `<div class="notice warning">${icon("info")}<span>Add your expected income to calculate what is safe to spend.</span><button class="text-button" data-action="edit-profile">Set income</button></div>`
    : "";
  const demoNotice = state.profile.demoMode
    ? `<div class="notice">${icon("info")}<span>You’re exploring sample data. Nothing here is connected to a real bank.</span><button class="text-button" data-action="start-fresh">Start fresh</button></div>`
    : "";
  const householdNoticeDismissed = (() => {
    try {
      return localStorage.getItem(HOUSEHOLD_NOTICE_DISMISSED_KEY) === "yes";
    } catch {
      return false;
    }
  })();
  const householdNotice = state.household.profiles.length > 1 && !householdNoticeDismissed
    ? `<div class="notice individual-budget-notice">${icon("info")}<span>You’re viewing <strong>${escapeHTML(state.profile.name)}’s</strong> individual budget. The other profile’s income, activity, bills and goals are kept separate.</span><button class="notice-dismiss" type="button" data-action="dismiss-household-notice" aria-label="Close individual budget message">${icon("close")}</button></div>`
    : "";

  return `${demoNotice}${householdNotice}${setupNotice}
    <section class="overview-grid" aria-label="Budget summary">
      <article class="hero-card">
        <div class="hero-content">
          <p class="hero-label"><span class="dot"></span> Safe to spend</p>
          <div class="hero-value">${money(summary.safeToSpend)}</div>
          <p class="hero-subtitle"><strong>${money(summary.dailySafe)}</strong> per day ${summary.isCurrentPeriod ? `for the next ${summary.daysLeft} day${summary.daysLeft === 1 ? "" : "s"}` : `across this ${selectedPeriodName()}`}, after fixed costs and goal contributions.</p>
        </div>
        <div class="hero-stats">
          <div class="hero-stat"><span>Expected income</span><strong>${money(summary.expectedIncome)}</strong></div>
          <div class="hero-stat"><span>Spent so far</span><strong>${money(summary.expenseTotal)}</strong></div>
          <div class="hero-stat"><span>Ready to assign</span><strong class="${summary.readyToAssign < 0 ? "negative" : safeClass}">${money(summary.readyToAssign)}</strong></div>
        </div>
      </article>

      <article class="card snapshot-card">
        <div class="section-heading"><div><h2>${selectedPeriodTitle()} snapshot</h2><p>${periodLabel(period)}</p></div><button class="text-button" data-action="go-plan">View plan</button></div>
        <div class="snapshot-list">
          <div class="snapshot-row"><span class="snapshot-icon income">↗</span><span class="snapshot-copy"><strong>Expected income</strong><span>${money(summary.incomeReceived)} received</span></span><strong class="snapshot-amount">${money(summary.expectedIncome)}</strong></div>
          <div class="snapshot-row"><span class="snapshot-icon planned">◎</span><span class="snapshot-copy"><strong>Assigned</strong><span>Including savings goals</span></span><strong class="snapshot-amount">${money(plannedTotal)}</strong></div>
          <div class="snapshot-row"><span class="snapshot-icon spent">↘</span><span class="snapshot-copy"><strong>Spent</strong><span>${Math.round(summary.spentPercent)}% of income</span></span><strong class="snapshot-amount">${money(summary.expenseTotal)}</strong></div>
        </div>
        <div class="snapshot-track" aria-label="${Math.round(progress)}% of income spent"><span style="width:${progress}%"></span></div>
        <p class="snapshot-caption">${Math.round(progress)}% of expected income has been spent</p>
      </article>
    </section>

    <section class="content-grid">
      <article class="card">
        <div class="section-heading"><div><h2>Spending plan</h2><p>Your most active categories</p></div><button class="text-button" data-action="go-plan">All categories</button></div>
        ${topCategories.length ? `<div class="budget-list">${topCategories.map(renderBudgetRow).join("")}</div>` : renderEmpty("wallet", `Build your ${selectedPeriodName()} plan`, `Assign money to categories to see how spending tracks for this ${selectedPeriodName()}.`, "Set up plan", "go-plan")}
      </article>
      <article class="card">
        <div class="section-heading"><div><h2>Coming up</h2><p>${periodLabel(period)}</p></div><button class="text-button" data-action="add-bill">Add bill</button></div>
        ${bills.length ? `<div class="bill-list">${bills.map(renderBillRow).join("")}</div>` : renderEmpty("calendar", `No bills in this ${selectedPeriodName()}`, "Add recurring bills so your safe-to-spend number stays realistic.", "Add a bill", "add-bill")}
      </article>
    </section>

    <section class="content-grid">
      <article class="card">
        <div class="section-heading"><div><h2>Recent activity</h2><p>${recent.length} transaction${recent.length === 1 ? "" : "s"} this ${selectedPeriodName()}</p></div><button class="text-button" data-action="go-activity">See all</button></div>
        ${recent.length ? `<div class="transaction-list">${recent.map(renderTransactionRow).join("")}</div>` : renderEmpty("activity", `No transactions this ${selectedPeriodName()}`, "Add spending and income manually, or import a bank CSV.", "Add transaction", "add-transaction")}
      </article>
      <article class="card">
        <div class="section-heading"><div><h2>Goals</h2><p>Future you will thank you</p></div><button class="text-button" data-action="go-goals">View goals</button></div>
        ${renderGoalMiniList()}
      </article>
    </section>`;
}

function renderBudgetRow(category) {
  const percent = clamp(category.percent, 0, 100);
  const status = category.percent > 100 ? "over" : category.percent >= 80 ? "warn" : "";
  return `<div class="budget-row" data-category-id="${escapeHTML(category.id)}">
    <span class="category-icon">${escapeHTML(category.icon)}</span>
    <span class="category-name"><strong>${escapeHTML(category.name)}</strong><span>${money(category.spent)} spent of ${money(category.budget)}</span></span>
    <span class="progress-wrap"><span class="progress-bar"><span class="${status}" style="width:${percent}%"></span></span><span class="progress-label">${Math.round(category.percent)}% used</span></span>
    <span class="budget-remaining"><strong class="${category.remaining < 0 ? "over" : ""}">${money(category.remaining)}</strong><span>${category.remaining < 0 ? "over" : "left"}</span></span>
  </div>`;
}

function renderBillRow(bill, actions = false) {
  const due = parseLocalDate(bill.nextDue);
  const category = categoryById(bill.categoryId);
  const partner = bill.shared ? state.household.profiles.find((profile) => profile.id === bill.sharedWithProfileId) : null;
  const sharing = bill.shared ? ` · Shared ${money(bill.sharedTotal)} · ${escapeHTML(partner?.name || "Partner")} ${money(bill.sharedPartnerAmount)}` : "";
  return `<div class="bill-row">
    <span class="date-badge"><strong>${due.getDate()}</strong><span>${formatDate(bill.nextDue, { month: "short" })}</span></span>
    <span class="row-copy"><strong>${escapeHTML(bill.name)}${bill.shared ? ' <em class="shared-badge">Shared</em>' : ""}</strong><span>${escapeHTML(category?.name || "Uncategorised")} · ${escapeHTML(bill.frequency || "monthly")}${bill.autopay ? " · Auto" : ""}${sharing}</span></span>
    <span class="row-amount">${money(bill.amount)}${actions ? `<span class="transaction-actions"><button class="icon-button" data-action="pay-bill" data-id="${escapeHTML(bill.id)}" aria-label="Mark ${escapeHTML(bill.name)} paid">${icon("check")}</button><button class="icon-button" data-action="edit-bill" data-id="${escapeHTML(bill.id)}" aria-label="Edit ${escapeHTML(bill.name)}">${icon("edit")}</button></span>` : ""}</span>
  </div>`;
}

function renderTransactionRow(transaction, actions = false) {
  const category = categoryById(transaction.categoryId);
  const isIncome = transaction.type === "income";
  return `<div class="transaction-row" data-search="${escapeHTML(`${transaction.name} ${category?.name || ""}`.toLowerCase())}" data-category="${escapeHTML(transaction.categoryId || "income")}">
    <span class="transaction-icon">${isIncome ? "↗" : escapeHTML(category?.icon || "•")}</span>
    <span class="row-copy"><strong>${escapeHTML(transaction.name)}</strong><span>${isIncome ? "Income" : escapeHTML(category?.name || "Uncategorised")} · ${formatDate(transaction.date, { day: "numeric", month: "short" })}</span></span>
    <span class="row-amount ${isIncome ? "income" : ""}">${isIncome ? "+" : "−"}${money(transaction.amount)}</span>
    ${actions ? `<span class="transaction-actions"><button class="icon-button" data-action="edit-transaction" data-id="${escapeHTML(transaction.id)}" aria-label="Edit transaction">${icon("edit")}</button><button class="icon-button danger" data-action="delete-transaction" data-id="${escapeHTML(transaction.id)}" aria-label="Delete transaction">${icon("trash")}</button></span>` : ""}
  </div>`;
}

function renderGoalMiniList() {
  const goals = state.goals.filter((goal) => !goal.archived).slice(0, 3);
  if (!goals.length) return renderEmpty("goal", "No savings goals", "Turn a future expense into a small monthly habit.", "Create a goal", "add-goal");
  return `<div class="goal-list">${goals.map((goal) => {
    const percent = goal.target ? clamp((goal.saved / goal.target) * 100, 0, 100) : 0;
    return `<div class="snapshot-row"><span class="snapshot-icon planned">${escapeHTML(goal.icon)}</span><span class="snapshot-copy"><strong>${escapeHTML(goal.name)}</strong><span>${Math.round(percent)}% complete</span></span><strong class="snapshot-amount">${money(goal.saved, { compact: true })}</strong></div>`;
  }).join("")}</div>`;
}

function renderPlan() {
  const period = selectedPeriod();
  const summary = calculateBudget(state, period);
  const groups = Object.entries(GROUPS);
  const assignedPercent = summary.expectedIncome ? clamp(((summary.categoryBudget + summary.goalContributions) / summary.expectedIncome) * 100, 0, 100) : 0;
  const planEditCopy = viewPeriod.kind === "monthly"
    ? "Tap any category to change its monthly amount"
    : `Showing this ${selectedPeriodName()}’s share of your monthly plan. Tap a category to change its saved monthly amount.`;
  return `<section class="metrics-grid">
      ${renderMetric("Expected income", summary.expectedIncome, "↗", `${money(summary.incomeReceived)} received`)}
      ${renderMetric("Assigned", summary.categoryBudget + summary.goalContributions, "◎", `${Math.round(assignedPercent)}% of income`)}
      ${renderMetric("Spent", summary.expenseTotal, "↘", `${Math.round(summary.spentPercent)}% of income`)}
      ${renderMetric("Ready to assign", summary.readyToAssign, "＋", summary.readyToAssign < 0 ? "Reduce category budgets" : "Unallocated money")}
    </section>
    <section class="plan-layout">
      <div>
        <div class="section-heading"><div><h2>Give your money a job</h2><p>${planEditCopy}</p></div><button class="button small secondary" data-action="add-category">${icon("plus")} Category</button></div>
        ${groups.map(([groupId, group]) => {
          const categories = summary.categoryRows.filter((category) => category.group === groupId);
          const total = categories.reduce((sum, category) => sum + category.budget, 0);
          return `<article class="card category-group">
            <div class="group-header"><div><h3>${group.label}</h3></div><span>${money(total)} assigned</span></div>
            <div class="budget-list">${categories.map((category) => `<button class="text-button budget-row" data-action="edit-category" data-id="${escapeHTML(category.id)}">${renderBudgetRowInner(category)}</button>`).join("")}</div>
          </article>`;
        }).join("")}
      </div>
      <aside class="card">
        <div class="section-heading"><div><h2>Plan balance</h2><p>${periodLabel(period)}</p></div></div>
        <div class="donut" style="--percent:${assignedPercent}"><span class="donut-copy"><strong>${Math.round(assignedPercent)}%</strong><span>of income assigned</span></span></div>
        <div class="legend">
          ${groups.map(([groupId, group]) => {
            const amount = summary.categoryRows.filter((category) => category.group === groupId).reduce((sum, category) => sum + category.budget, 0);
            return `<div class="legend-row"><i style="background:${group.colour}"></i><span>${group.label}</span><strong>${money(amount)}</strong></div>`;
          }).join("")}
          <div class="legend-row"><i style="background:var(--mint-deep)"></i><span>Savings goals</span><strong>${money(summary.goalContributions)}</strong></div>
        </div>
        <div class="notice ${summary.readyToAssign < 0 ? "warning" : ""}" style="margin:20px 0 0">${icon("info")}<span>${summary.readyToAssign < 0 ? `Your plan is ${money(Math.abs(summary.readyToAssign))} over expected income.` : `${money(summary.readyToAssign)} is still ready to assign.`}</span></div>
      </aside>
    </section>`;
}

function renderBudgetRowInner(category) {
  const percent = clamp(category.percent, 0, 100);
  const status = category.percent > 100 ? "over" : category.percent >= 80 ? "warn" : "";
  return `<span class="category-icon">${escapeHTML(category.icon)}</span>
    <span class="category-name"><strong>${escapeHTML(category.name)}</strong><span>${GROUPS[category.group]?.note || `${selectedPeriodTitle()} category`}</span></span>
    <span class="progress-wrap"><span class="progress-bar"><span class="${status}" style="width:${percent}%"></span></span><span class="progress-label">${money(category.spent)} of ${money(category.budget)} used</span></span>
    <span class="budget-remaining"><strong class="${category.remaining < 0 ? "over" : ""}">${money(category.remaining)}</strong><span>${category.remaining < 0 ? "over" : "left"}</span></span>`;
}

function renderMetric(label, value, symbol, note) {
  return `<article class="card metric-card"><div class="metric-label">${label}<span>${symbol}</span></div><div class="metric-value">${money(value)}</div><div class="metric-note">${note}</div></article>`;
}

function renderActivity() {
  const transactions = [...transactionsForPeriod(state.transactions, selectedPeriod())]
    .sort((a, b) => String(b.date).localeCompare(String(a.date)));
  const grouped = transactions.reduce((groups, transaction) => {
    (groups[transaction.date] ||= []).push(transaction);
    return groups;
  }, {});
  return `<div class="toolbar">
      <label class="search-box">${icon("search")}<span class="visually-hidden">Search transactions</span><input id="transaction-search" type="search" placeholder="Search transactions" /></label>
      <div class="toolbar-actions">
        <select class="filter-select" id="transaction-filter" aria-label="Filter by category"><option value="all">All categories</option><option value="income">Income</option>${state.categories.filter((category) => !category.archived).map((category) => `<option value="${escapeHTML(category.id)}">${escapeHTML(category.name)}</option>`).join("")}</select>
        <button class="button secondary" data-action="import-csv">${icon("upload")} Import CSV</button>
        <button class="button" data-action="add-transaction">${icon("plus")} Add</button>
      </div>
    </div>
    <article class="card" id="activity-list">
      ${transactions.length ? Object.entries(grouped).map(([date, items]) => `<section class="transaction-date-group"><h2 class="transaction-date-heading">${formatDate(date, { weekday: "long", day: "numeric", month: "long" })}</h2><div class="transaction-list">${items.map((transaction) => renderTransactionRow(transaction, true)).join("")}</div></section>`).join("") : renderEmpty("activity", `No activity this ${selectedPeriodName()}`, "Add a transaction or import a CSV from your bank.", "Add transaction", "add-transaction")}
    </article>`;
}

function renderGoals() {
  const goals = state.goals.filter((goal) => !goal.archived);
  const totalSaved = goals.reduce((sum, goal) => sum + (Number(goal.saved) || 0), 0);
  const reserved = goals.reduce((sum, goal) => sum + selectedPeriodAmount(goal.monthlyContribution), 0);
  return `<div class="section-heading"><div><h2>${money(totalSaved)} saved across ${goals.length} goal${goals.length === 1 ? "" : "s"}</h2><p>${money(reserved)} reserved this ${selectedPeriodName()}</p></div><button class="button" data-action="add-goal">${icon("plus")} New goal</button></div>
    ${goals.length ? `<section class="goals-grid">${goals.map(renderGoalCard).join("")}</section>` : `<article class="card">${renderEmpty("goal", "Make the future feel affordable", `Create a target and Brady Budget will reserve a manageable amount each ${selectedPeriodName()} before calculating what is safe to spend.`, "Create your first goal", "add-goal")}</article>`}`;
}

function renderGoalCard(goal) {
  const projection = goalProjection(goal);
  const percent = goal.target ? clamp((goal.saved / goal.target) * 100, 0, 100) : 0;
  const dateText = goal.targetDate ? formatDate(goal.targetDate, { month: "short", year: "numeric" }) : projection.projectedDate ? formatDate(projection.projectedDate, { month: "short", year: "numeric" }) : "No target date";
  return `<article class="card goal-card">
    <div class="goal-top"><span class="goal-icon" style="background:${escapeHTML(goal.colour || "#e8e2f8")}22">${escapeHTML(goal.icon)}</span><button class="icon-button" data-action="edit-goal" data-id="${escapeHTML(goal.id)}" aria-label="Edit ${escapeHTML(goal.name)}">${icon("edit")}</button></div>
    <h3>${escapeHTML(goal.name)}</h3><div class="goal-target">Target ${money(goal.target)} · ${escapeHTML(dateText)}</div>
    <div class="goal-value">${money(goal.saved)}</div>
    <div class="goal-progress"><span style="width:${percent}%;background:${escapeHTML(goal.colour || "#9184c8")}"></span></div>
    <div class="goal-footer"><span>${Math.round(percent)}% complete</span><span>${money(projection.remaining)} to go</span></div>
    <div class="goal-actions"><button class="button small accent" data-action="contribute-goal" data-id="${escapeHTML(goal.id)}">${icon("plus")} Add money</button><span class="button small ghost">${money(selectedPeriodAmount(goal.monthlyContribution))}/${viewPeriod.kind === "weekly" ? "wk" : viewPeriod.kind === "fortnightly" ? "fortnight" : "mo"}</span></div>
  </article>`;
}

function renderShopping() {
  const shopping = state.household.shopping || { budget: 0, items: [] };
  const items = shopping.items || [];
  const shoppingTotals = calculateShoppingList(items, shopping.budget);
  const { estimatedTotal, remaining, percent } = shoppingTotals;
  const storeTotals = SHOPPING_STORES.map((store) => ({
    ...store,
    total: items
      .filter((item) => normaliseStoreId(item.storeId) === store.id)
      .reduce((sum, item) => sum + (Math.max(1, Number(item.quantity) || 1) * Math.max(0, Number(item.estimatedCost) || 0)), 0),
  })).filter((store) => store.total > 0);
  const openItems = items.filter((item) => !item.checked);
  const checkedItems = items.filter((item) => item.checked);
  const recurringItems = items.filter((item) => item.recurring);
  const weekLabel = shopping.weekKey ? formatDate(shopping.weekKey, { day: "numeric", month: "short" }) : "this week";
  return `<section class="shopping-summary card">
      <div class="shopping-summary-copy">
        <p class="hero-label"><span class="dot"></span> Shared grocery plan</p>
        <div class="shopping-total">${groceryMoney(estimatedTotal)}</div>
        <p>${items.length} item${items.length === 1 ? "" : "s"} across ${storeTotals.length || 0} store${storeTotals.length === 1 ? "" : "s"} · ${money(remaining)} ${remaining < 0 ? "over" : "left in"} the ${money(shopping.budget)} grocery budget · week of ${weekLabel}</p>
        ${storeTotals.length ? `<div class="shopping-store-breakdown">${storeTotals.map((store) => `<span>${store.label}<strong>${groceryMoney(store.total)}</strong></span>`).join("")}</div>` : ""}
      </div>
      <div class="shopping-summary-actions"><button class="button secondary" data-action="set-shopping-budget">Set budget</button><button class="button accent" data-action="add-shopping-item">${icon("plus")} Add item</button></div>
      <div class="shopping-budget-track"><span class="${remaining < 0 ? "over" : ""}" style="width:${percent}%"></span></div>
    </section>
    <div class="notice">${icon("info")}<span>Tick items off as you find them. This household list updates live on both phones${recurringItems.length ? ` and resets ${recurringItems.length} weekly item${recurringItems.length === 1 ? "" : "s"} every Monday` : ""}.</span></div>
    <article class="card shopping-card">
      <div class="section-heading"><div><h2>To buy</h2><p>${openItems.length} remaining · added by either profile</p></div></div>
      ${openItems.length ? `<div class="shopping-list">${openItems.map(renderShoppingRow).join("")}</div>` : renderEmpty("cart", "The list is clear", "Add groceries and estimated prices to plan the next shop together.", "Add an item", "add-shopping-item")}
      ${checkedItems.length ? `<div class="shopping-complete"><div class="group-header"><h3>In the trolley</h3><span>${checkedItems.length} checked</span></div><div class="shopping-list">${checkedItems.map(renderShoppingRow).join("")}</div></div>` : ""}
    </article>`;
}

function renderShoppingRow(item) {
  const addedBy = state.household.profiles.find((profile) => profile.id === item.addedByProfileId);
  const total = Math.max(1, Number(item.quantity) || 1) * Math.max(0, Number(item.estimatedCost) || 0);
  const estimateLabel = ["memory", "manual"].includes(item.priceSource) ? `${storeLabel(item.storeId)} saved price` : `${storeLabel(item.storeId)} estimate`;
  return `<div class="shopping-row ${item.checked ? "checked" : ""}">
    <button class="shopping-check" type="button" data-action="toggle-shopping-item" data-id="${escapeHTML(item.id)}" aria-pressed="${item.checked}" aria-label="${item.checked ? "Put" : "Mark"} ${escapeHTML(item.name)} ${item.checked ? "back on list" : "in trolley"}">${item.checked ? icon("check") : ""}</button>
    <span class="shopping-copy"><strong>${escapeHTML(item.name)}${item.recurring ? '<em class="recurring-badge">Weekly</em>' : ""}</strong><span>${Math.max(1, Number(item.quantity) || 1)} × ${groceryMoney(item.estimatedCost)} · ${escapeHTML(estimateLabel)} · added by ${escapeHTML(addedBy?.name || "Household")}</span></span>
    <strong class="shopping-price">${groceryMoney(total)}</strong>
    <span class="shopping-actions"><button class="icon-button" data-action="edit-shopping-item" data-id="${escapeHTML(item.id)}" aria-label="Edit ${escapeHTML(item.name)}">${icon("edit")}</button><button class="icon-button danger" data-action="delete-shopping-item" data-id="${escapeHTML(item.id)}" aria-label="Delete ${escapeHTML(item.name)}">${icon("trash")}</button></span>
  </div>`;
}

function renderMore() {
  const bills = [...state.bills].filter((bill) => bill.active !== false).sort((a, b) => String(a.nextDue).localeCompare(String(b.nextDue)));
  const sharedBills = bills.filter((bill) => bill.shared);
  const periodBillTotal = bills.reduce((sum, bill) => sum + recurringAmountForPeriod(bill.amount, bill.frequency, viewPeriod.kind), 0);
  const activeShared = sharedBills.reduce((sum, bill) => sum + recurringAmountForPeriod(bill.amount, bill.frequency, viewPeriod.kind), 0);
  const partnerShared = sharedBills.reduce((sum, bill) => sum + recurringAmountForPeriod(bill.sharedPartnerAmount, bill.frequency, viewPeriod.kind), 0);
  const sharedTotal = sharedBills.reduce((sum, bill) => sum + recurringAmountForPeriod(bill.sharedTotal, bill.frequency, viewPeriod.kind), 0);
  const partner = state.household.profiles.find((profile) => profile.id !== state.household.activeProfileId);
  const bytes = stateSize(state);
  const sizeLabel = bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KB`;
  const remoteAccount = getRemoteAccount();
  const syncStatus = getRemoteStatus();
  const syncCopy = `${SYNC_LABELS[syncStatus] || "Connecting"}${remoteAccount ? ` · signed in as ${remoteAccount.displayName}` : ""}`;
  return `<section class="more-grid">
    <div>
      <article class="card">
        <div class="section-heading"><div><h2>Bills & subscriptions</h2><p>${selectedPeriodTitle()} estimate ${money(periodBillTotal)} · individual amounts are shown below</p></div><button class="button small secondary" data-action="add-bill">${icon("plus")} Add bill</button></div>
        ${sharedBills.length ? `<div class="shared-summary"><span><small>Shared this ${selectedPeriodName()}</small><strong>${money(sharedTotal)}</strong></span><span><small>${escapeHTML(state.profile.name)} pays</small><strong>${money(activeShared)}</strong></span><span><small>${escapeHTML(partner?.name || "Partner")} pays</small><strong>${money(partnerShared)}</strong></span></div>` : ""}
        ${bills.length ? `<div class="bill-list">${bills.map((bill) => renderBillRow(bill, true)).join("")}</div>` : renderEmpty("calendar", "No recurring bills", "Add rent, utilities and subscriptions to keep them visible.", "Add a bill", "add-bill")}
      </article>
      <article class="card" style="margin-top:22px">
        <div class="section-heading"><div><h2>Settings & data</h2><p>You own your information</p></div></div>
          <div class="settings-list">
            <div class="settings-row"><span class="sync-indicator ${escapeHTML(syncStatus)}"></span><span><strong>Household sync</strong><small id="sync-status-copy">${escapeHTML(syncCopy)}</small></span><a class="button small secondary" href="/budget/logout">Sign out</a></div>
          ${remoteAccount?.canManageAccess ? `<div class="settings-row"><span>🔐</span><span><strong>Household login</strong><small>Create or reset your partner’s restricted Brady Budget login</small></span><a class="button small secondary" href="/budget/access">Manage</a></div>` : ""}
          <div class="settings-row"><span>👥</span><span><strong>Household profiles</strong><small>${state.household.profiles.length} of ${PROFILE_LIMIT} profiles · budgets stay separate</small></span><button class="button small secondary" data-action="manage-profiles">Manage</button></div>
          <div class="settings-row"><span>👤</span><span><strong>Profile & preferences</strong><small>Name, income, currency and appearance</small></span><button class="button small secondary" data-action="edit-profile">Edit</button></div>
          <div class="settings-row"><span>${icon("download")}</span><span><strong>Backup both profiles</strong><small>Export one complete household JSON backup</small></span><button class="button small secondary" data-action="export-json">Export</button></div>
          <div class="settings-row"><span>${icon("upload")}</span><span><strong>Restore a backup</strong><small>Import a Brady Budget or Harbour JSON file</small></span><button class="button small secondary" data-action="import-json">Import</button></div>
          <div class="settings-row"><span>CSV</span><span><strong>Import bank activity</strong><small>Add transactions from a bank CSV export</small></span><button class="button small secondary" data-action="import-csv">Import</button></div>
          <div class="settings-row"><span>CSV</span><span><strong>Export this profile’s transactions</strong><small>Open ${escapeHTML(state.profile.name)}’s activity in any spreadsheet</small></span><button class="button small secondary" data-action="export-csv">Export</button></div>
          <div class="settings-row"><span>🧪</span><span><strong>Sample budget</strong><small>Replace current data with the guided demo</small></span><button class="button small secondary" data-action="load-demo">Load</button></div>
          <div class="settings-row"><span>${icon("trash")}</span><span><strong>Reset household budget</strong><small>Replace the synced household data with a clean setup</small></span><button class="button small secondary" data-action="reset-data">Reset</button></div>
        </div>
        <div class="storage-meter"><span style="width:${clamp((bytes / 5_000_000) * 100, 0, 100)}%"></span></div>
        <p class="snapshot-caption">${sizeLabel} cached on this device · the authoritative household copy is encrypted in transit and stored on Mission Control</p>
      </article>
    </div>
    <aside>
      <article class="card about-card">
        <a class="brand" href="#overview"><span class="brand-mark"><strong>BB</strong></span><span class="brand-copy"><strong>Brady</strong><small>Budget</small></span></a>
        <h2 style="font-family:Georgia,serif;font-weight:500;margin:0">Calm money, clear choices.</h2>
        <p>Brady Budget combines envelope planning with a simple safe-to-spend number. Household data is stored on your private Mission Control server and synced between signed-in phones.</p>
        <p><strong style="color:white">Important:</strong> this is a planning tool, not financial advice. Keep regular backups for an additional copy of your data.</p>
        ${deferredInstallPrompt ? `<button class="button accent block" data-action="install-app" style="margin-top:12px">Install Brady Budget</button>` : ""}
        <div class="about-version">Version 3.3 · Flexible period views</div>
      </article>
    </aside>
  </section>`;
}

function renderEmpty(iconName, title, copy, buttonLabel, action) {
  return `<div class="empty-state"><span class="empty-icon">${icon(iconName)}</span><h3>${title}</h3><p>${copy}</p><button class="button small secondary" data-action="${action}">${buttonLabel}</button></div>`;
}

function renderOnboarding() {
  const steps = [0, 1, 2].map((step) => `<span class="${onboardingStep === step ? "active" : ""}"></span>`).join("");
  const content = onboardingStep === 0 ? onboardingWelcome() : onboardingStep === 1 ? onboardingProfile() : onboardingTemplate();
  $("#onboarding-root").innerHTML = `<div class="onboarding" role="dialog" aria-modal="true" aria-labelledby="onboarding-title">
    <div class="onboarding-card">
      <aside class="onboarding-art">
        <a class="brand" href="#"><span class="brand-mark"><strong>BB</strong></span><span class="brand-copy"><strong>Brady</strong><small>Budget</small></span></a>
        <div class="art-sun"></div><div class="art-wave"></div>
        <div class="art-copy"><p>“A budget should feel like a map, not a punishment.”</p></div>
      </aside>
      <section class="onboarding-content"><div class="step-dots">${steps}</div>${content}</section>
    </div>
  </div>`;
  optimiseFormControls($("#onboarding-root"));
}

function onboardingWelcome() {
  return `<h1 id="onboarding-title">Know what’s safe to spend.</h1>
    <p>Brady Budget protects bills and savings first, then gives you one calm number for everything else. Your household data syncs securely through Mission Control.</p>
    <ul class="benefit-list">
      <li><span>${icon("check")}</span> Weekly, fortnightly or monthly views</li>
      <li><span>${icon("check")}</span> Bills, transactions and savings goals in one place</li>
      <li><span>${icon("check")}</span> Offline access with JSON and CSV backups</li>
    </ul>
    <div class="onboarding-actions"><button class="button" data-action="onboarding-next">Set up my budget</button><button class="button secondary" data-action="load-demo-direct">Explore sample</button></div>`;
}

function onboardingProfile() {
  return `<h1 id="onboarding-title">Let’s start with your income.</h1>
    <p>Use after-tax income. Brady Budget converts weekly or fortnightly pay into a monthly planning amount.</p>
    <form id="onboarding-profile" data-form="onboarding-profile">
      <div class="form-grid">
        <div class="field full"><label for="onboard-name">First name</label><input id="onboard-name" name="name" autocomplete="given-name" placeholder="Dean" value="${escapeHTML(state.profile.name)}" required /></div>
        <div class="field"><label for="onboard-income">Take-home pay</label><div class="money-input"><span>$</span><input id="onboard-income" name="income" type="number" min="0" step="0.01" placeholder="3200" required /></div></div>
        <div class="field"><label for="onboard-cadence">How often?</label><select id="onboard-cadence" name="cadence"><option value="weekly">Weekly</option><option value="fortnightly" selected>Fortnightly</option><option value="monthly">Monthly</option><option value="annual">Annually</option></select></div>
      </div>
      <div class="onboarding-actions"><button class="button secondary" type="button" data-action="onboarding-back">Back</button><button class="button" type="submit">Continue</button></div>
    </form>`;
}

function onboardingTemplate() {
  return `<h1 id="onboarding-title">Choose a helpful starting point.</h1>
    <p>These are suggestions, not rules. You can change every category and amount whenever you like.</p>
    <form data-form="onboarding-template">
      <div class="template-options">
        <label class="template-option"><input type="radio" name="template" value="balanced" checked /><span><strong>Guided plan</strong><small>Assigns 80% of income across common categories, leaving room for goals.</small></span><span>🧭</span></label>
        <label class="template-option"><input type="radio" name="template" value="simple" /><span><strong>Simple essentials</strong><small>A lighter plan with the everyday categories most people need.</small></span><span>🌿</span></label>
        <label class="template-option"><input type="radio" name="template" value="blank" /><span><strong>Blank slate</strong><small>Keep the categories, but enter every amount yourself.</small></span><span>✦</span></label>
      </div>
      <div class="onboarding-actions"><button class="button secondary" type="button" data-action="onboarding-back">Back</button><button class="button" type="submit">Open my budget</button></div>
    </form>`;
}

function openModal({ title, subtitle = "", body, size = "" }) {
  $("#toast-region").innerHTML = "";
  $("#modal-root").innerHTML = `<div class="modal-backdrop" data-action="close-modal"><section class="modal ${size}" role="dialog" aria-modal="true" aria-labelledby="modal-title" data-modal-panel>
    <header class="modal-header"><div><h2 id="modal-title">${title}</h2>${subtitle ? `<p>${subtitle}</p>` : ""}</div><button class="modal-close" type="button" data-action="close-modal" aria-label="Close">${icon("close")}</button></header>
    ${body}
  </section></div>`;
  document.body.classList.add("modal-open");
  optimiseFormControls($("#modal-root"));
  setTimeout(() => $("#modal-root input:not([type='radio']):not([type='checkbox']), #modal-root select")?.focus(), 30);
}

function closeModal() {
  $("#modal-root").innerHTML = "";
  document.body.classList.remove("modal-open");
  pendingCSVTransactions = [];
}

function howToGuideModal() {
  openModal({
    title: "How to use Brady Budget",
    subtitle: "Follow these easy steps. You can open this guide whenever you need help.",
    size: "guide-modal",
    body: `<div class="how-to-guide">
      <section class="guide-step"><span class="guide-number">1</span><div><h3>Add the money you get paid</h3><p>When you first start, type how much money you get and how often you get it. To change it later, tap <strong>More</strong>, find <strong>Profile &amp; preferences</strong>, then tap <strong>Edit</strong>.</p></div></section>
      <section class="guide-step"><span class="guide-number">2</span><div><h3>Plan where your money will go</h3><p>Tap <strong>Plan</strong>. Tap a row such as Food or Transport. Type how much money you want to use for it each month, then tap <strong>Save category</strong>. The app works out the weekly or fortnightly share for you.</p><ul><li>A category means one kind of spending, such as Food.</li><li><strong>Ready to assign</strong> is money that does not have a job yet. Keep it at $0 or higher.</li></ul></div></section>
      <section class="guide-step"><span class="guide-number">3</span><div><h3>Add money you get or spend</h3><p>Tap <strong>Activity</strong>, then tap <strong>Add</strong>. Choose <strong>Income</strong> when you get money. Choose <strong>Expense</strong> when you spend money. Add the name, amount, date and category, then save it.</p></div></section>
      <section class="guide-step"><span class="guide-number">4</span><div><h3>Choose the dates you want to see</h3><p>Tap the <strong>calendar</strong> at the top. Choose <strong>Weekly</strong>, <strong>Fortnightly</strong> or <strong>Monthly</strong>. Choose a date, then tap <strong>View budget</strong>. This choice is used on every budget page.</p><p>Tap <strong>Overview</strong>. <strong>Safe to spend</strong> shows money that is still free for the dates you chose. The shared shopping checklist stays on the current shopping week so both phones see the same list.</p></div></section>
      <section class="guide-step"><span class="guide-number">5</span><div><h3>Keep track of bills and saving goals</h3><p>For a bill, tap <strong>More</strong>, then <strong>Add bill</strong>. Add the amount and the date it must be paid. To save for something, tap <strong>Goals</strong>, then <strong>New goal</strong>.</p><ul><li>If the share option is shown, enter the full bill and the part you will pay. The other part is worked out for you.</li></ul></div></section>
      <section class="guide-step"><span class="guide-number">6</span><div><h3>Make a shopping list</h3><p>Tap <strong>Shopping</strong>, then follow these steps:</p><ul><li>Tap <strong>Set budget</strong> and enter the most you want to spend.</li><li>Tap <strong>Add item</strong> and choose the store.</li><li>Type the item. The app will suggest a price. Change it if you know a better price.</li><li>Add the amount you need. Turn on <strong>Add every week</strong> for things you buy often.</li><li>Tap <strong>Add item</strong>. The expected total changes as items are added.</li><li>At the shop, tap the empty tick beside an item when it goes into your trolley.</li></ul></div></section>
      <section class="guide-step"><span class="guide-number">7</span><div><h3>Use your saved price again</h3><p>If the app does not know a product, type its name and add your own price. Next time you choose that store, it will appear as a <strong>Saved product</strong>. The shopping list also updates on the other phone using Brady Budget.</p></div></section>
      <p class="guide-tip"><strong>Small steps are fine.</strong> Add spending as it happens and check Overview often. You can change any amount later.</p>
    </div><div class="modal-actions"><button class="button" type="button" data-action="close-modal">Got it</button></div>`,
  });
}

function budgetPeriodModal() {
  openModal({
    title: "Choose budget view",
    subtitle: "Choose how much time you want to see across the whole app. The shared shopping checklist stays on the current week.",
    body: `<form data-form="period-picker">
      <div class="field"><span>Show my budget</span><div class="segmented period-segmented">
        ${["weekly", "fortnightly", "monthly"].map((kind) => `<label><input type="radio" name="periodKind" value="${kind}" ${viewPeriod.kind === kind ? "checked" : ""} /><span>${periodTitle(kind)}</span></label>`).join("")}
      </div></div>
      <div class="field"><label for="period-anchor">Choose a date</label><input id="period-anchor" name="anchor" type="date" value="${escapeHTML(viewPeriod.anchor)}" required /><span class="hint">Weeks and fortnights start on Monday. For monthly view, any date in the month works.</span></div>
      <div class="period-preview">${icon("calendar")}<span><small>You will see</small><strong id="period-preview-label">${periodLabel(viewPeriod)}</strong></span></div>
      <div class="modal-actions"><button class="button secondary" type="button" data-action="close-modal">Cancel</button><button class="button" type="submit">View budget</button></div>
    </form>`,
  });
}

function updatePeriodPreview() {
  const anchor = $("#period-anchor")?.value;
  const kind = $("input[name='periodKind']:checked", $("#modal-root"))?.value;
  const preview = $("#period-preview-label");
  if (anchor && kind && preview) preview.textContent = periodLabel({ kind, anchor });
}

function categoryOptions(selected = "") {
  return state.categories.filter((category) => !category.archived).map((category) => `<option value="${escapeHTML(category.id)}" ${category.id === selected ? "selected" : ""}>${escapeHTML(category.icon)} ${escapeHTML(category.name)}</option>`).join("");
}

function transactionModal(transaction = null) {
  const item = transaction || { id: "", type: "expense", name: "", amount: "", date: toLocalISO(), categoryId: "groceries", note: "" };
  openModal({
    title: transaction ? "Edit transaction" : "Add transaction",
    subtitle: "Record money in or out. Amounts are stored on this device.",
    body: `<form data-form="transaction"><input type="hidden" name="id" value="${escapeHTML(item.id)}" />
      <div class="form-grid">
        <div class="field full"><span>Type</span><div class="segmented"><label><input type="radio" name="type" value="expense" ${item.type !== "income" ? "checked" : ""} /><span>Expense</span></label><label><input type="radio" name="type" value="income" ${item.type === "income" ? "checked" : ""} /><span>Income</span></label></div></div>
        <div class="field full"><label for="txn-name">Description</label><input id="txn-name" name="name" placeholder="Groceries" value="${escapeHTML(item.name)}" required /></div>
        <div class="field"><label for="txn-amount">Amount</label><div class="money-input"><span>$</span><input id="txn-amount" name="amount" type="number" min="0.01" step="0.01" value="${escapeHTML(item.amount)}" required /></div></div>
        <div class="field"><label for="txn-date">Date</label><input id="txn-date" name="date" type="date" value="${escapeHTML(item.date)}" required /></div>
        <div class="field full"><label for="txn-category">Category</label><select id="txn-category" name="categoryId">${categoryOptions(item.categoryId)}</select></div>
        <div class="field full"><label for="txn-note">Note <span class="hint">optional</span></label><textarea id="txn-note" name="note" placeholder="Add context">${escapeHTML(item.note)}</textarea></div>
      </div>
      <div class="modal-actions">${transaction ? `<button class="button ghost" type="button" data-action="delete-transaction" data-id="${escapeHTML(transaction.id)}">Delete</button>` : ""}<button class="button secondary" type="button" data-action="close-modal">Cancel</button><button class="button" type="submit">${transaction ? "Save changes" : "Add transaction"}</button></div>
    </form>`,
  });
}

function categoryModal(category = null) {
  const item = category || { id: "", name: "", icon: "✨", group: "everyday", budget: "" };
  openModal({
    title: category ? "Edit category" : "Add category",
    subtitle: "Fixed costs are protected before Brady Budget calculates safe-to-spend.",
    body: `<form data-form="category"><input type="hidden" name="id" value="${escapeHTML(item.id)}" />
      <div class="form-grid">
        <div class="field"><label for="category-icon">Icon</label><input id="category-icon" name="icon" value="${escapeHTML(item.icon)}" maxlength="8" required /></div>
        <div class="field"><label for="category-name">Name</label><input id="category-name" name="name" value="${escapeHTML(item.name)}" placeholder="Pet care" required /></div>
        <div class="field"><label for="category-group">Group</label><select id="category-group" name="group">${Object.entries(GROUPS).map(([id, group]) => `<option value="${id}" ${item.group === id ? "selected" : ""}>${group.label}</option>`).join("")}</select></div>
        <div class="field"><label for="category-budget">Monthly amount</label><div class="money-input"><span>$</span><input id="category-budget" name="budget" type="number" min="0" step="1" value="${escapeHTML(item.budget)}" required /></div></div>
      </div>
      <div class="modal-actions">${category && category.id !== "uncategorised" ? `<button class="button ghost" type="button" data-action="archive-category" data-id="${escapeHTML(category.id)}">Archive</button>` : ""}<button class="button secondary" type="button" data-action="close-modal">Cancel</button><button class="button" type="submit">Save category</button></div>
    </form>`,
  });
}

function goalModal(goal = null) {
  const item = goal || { id: "", name: "", icon: "🎯", target: "", saved: 0, monthlyContribution: "", targetDate: "", colour: "#9184c8" };
  openModal({
    title: goal ? "Edit goal" : "Create a savings goal",
    subtitle: "Monthly contributions are reserved before your safe-to-spend amount.",
    body: `<form data-form="goal"><input type="hidden" name="id" value="${escapeHTML(item.id)}" />
      <div class="form-grid">
        <div class="field"><label for="goal-icon">Icon</label><input id="goal-icon" name="icon" value="${escapeHTML(item.icon)}" maxlength="8" required /></div>
        <div class="field"><label for="goal-name">Goal name</label><input id="goal-name" name="name" value="${escapeHTML(item.name)}" placeholder="Emergency fund" required /></div>
        <div class="field"><label for="goal-target">Target</label><div class="money-input"><span>$</span><input id="goal-target" name="target" type="number" min="1" step="1" value="${escapeHTML(item.target)}" required /></div></div>
        <div class="field"><label for="goal-saved">Already saved</label><div class="money-input"><span>$</span><input id="goal-saved" name="saved" type="number" min="0" step="1" value="${escapeHTML(item.saved)}" required /></div></div>
        <div class="field"><label for="goal-monthly">Monthly contribution</label><div class="money-input"><span>$</span><input id="goal-monthly" name="monthlyContribution" type="number" min="0" step="1" value="${escapeHTML(item.monthlyContribution)}" required /></div></div>
        <div class="field"><label for="goal-date">Target date</label><input id="goal-date" name="targetDate" type="date" value="${escapeHTML(item.targetDate)}" /></div>
      </div>
      <div class="modal-actions">${goal ? `<button class="button ghost" type="button" data-action="archive-goal" data-id="${escapeHTML(goal.id)}">Archive</button>` : ""}<button class="button secondary" type="button" data-action="close-modal">Cancel</button><button class="button" type="submit">Save goal</button></div>
    </form>`,
  });
}

function contributionModal(goal) {
  openModal({
    title: `Add to ${escapeHTML(goal.name)}`,
    subtitle: `${money(goal.saved)} saved of ${money(goal.target)}.`,
    body: `<form data-form="contribution"><input type="hidden" name="id" value="${escapeHTML(goal.id)}" /><div class="field"><label for="contribution-amount">Amount saved</label><div class="money-input"><span>$</span><input id="contribution-amount" name="amount" type="number" min="0.01" step="0.01" placeholder="100" required /></div></div><div class="modal-actions"><button class="button secondary" type="button" data-action="close-modal">Cancel</button><button class="button accent" type="submit">Add money</button></div></form>`,
  });
}

function billModal(bill = null) {
  const item = bill || { id: "", name: "", amount: "", nextDue: toLocalISO(), frequency: "monthly", categoryId: "utilities", autopay: false };
  const partner = state.household.profiles.find((profile) => profile.id !== state.household.activeProfileId);
  const canShare = Boolean(partner);
  const totalAmount = item.shared ? item.sharedTotal : item.amount;
  openModal({
    title: bill ? "Edit bill" : "Add a recurring bill",
    subtitle: canShare ? "Keep it individual or split the total between both profiles." : "Bills stay visible and protected in every budget view.",
    body: `<form data-form="bill"><input type="hidden" name="id" value="${escapeHTML(item.id)}" />
      <div class="form-grid">
        <div class="field full"><label for="bill-name">Bill or subscription</label><input id="bill-name" name="name" value="${escapeHTML(item.name)}" placeholder="Energy" required /></div>
        <div class="field"><label for="bill-amount">${canShare ? "Total bill amount" : "Amount"}</label><div class="money-input"><span>$</span><input id="bill-amount" name="amount" type="number" min="0.01" step="0.01" value="${escapeHTML(totalAmount)}" required /></div></div>
        <div class="field"><label for="bill-due">Next due</label><input id="bill-due" name="nextDue" type="date" value="${escapeHTML(item.nextDue)}" required /></div>
        <div class="field"><label for="bill-frequency">Frequency</label><select id="bill-frequency" name="frequency">${["weekly", "fortnightly", "monthly", "quarterly", "yearly"].map((frequency) => `<option value="${frequency}" ${item.frequency === frequency ? "selected" : ""}>${frequency[0].toUpperCase() + frequency.slice(1)}</option>`).join("")}</select></div>
        <div class="field"><label for="bill-category">Category</label><select id="bill-category" name="categoryId">${categoryOptions(item.categoryId)}</select></div>
        ${canShare ? `<div class="field full"><label for="bill-sharing">Who pays?</label><select id="bill-sharing" name="sharing"><option value="individual" ${!item.shared ? "selected" : ""}>${escapeHTML(state.profile.name)} only</option><option value="shared" ${item.shared ? "selected" : ""}>Share with ${escapeHTML(partner.name)}</option></select></div>
        <div class="field full" id="bill-split-fields" ${item.shared ? "" : "hidden"}><label for="bill-your-share">${escapeHTML(state.profile.name)} pays</label><div class="money-input"><span>$</span><input id="bill-your-share" name="yourShare" type="number" min="0" step="0.01" value="${escapeHTML(item.shared ? item.amount : "")}" /></div><div class="split-preview"><span>${escapeHTML(partner.name)} pays</span><strong id="bill-partner-share">${money(item.shared ? item.sharedPartnerAmount : 0)}</strong></div></div>` : ""}
        <div class="field full"><label><input type="checkbox" name="autopay" ${item.autopay ? "checked" : ""} /> Paid automatically</label></div>
      </div>
      <div class="modal-actions">${bill ? `<button class="button ghost" type="button" data-action="delete-bill" data-id="${escapeHTML(bill.id)}">Delete</button>` : ""}<button class="button secondary" type="button" data-action="close-modal">Cancel</button><button class="button" type="submit">Save bill</button></div>
    </form>`,
  });
  updateBillSplitPreview();
}

function updateBillSplitPreview() {
  const sharing = $("#bill-sharing");
  const fields = $("#bill-split-fields");
  if (!sharing || !fields) return;
  const shared = sharing.value === "shared";
  fields.hidden = !shared;
  const shareInput = $("#bill-your-share");
  if (shareInput) shareInput.required = shared;
  const total = Math.max(0, Number($("#bill-amount")?.value) || 0);
  const own = Math.max(0, Number(shareInput?.value) || 0);
  if ($("#bill-partner-share")) $("#bill-partner-share").textContent = money(Math.max(0, total - own));
}

function shoppingStoreOptions(selected = "aldi") {
  return SHOPPING_STORES.map((store) => `<option value="${store.id}" ${store.id === selected ? "selected" : ""}>${store.label}</option>`).join("");
}

function selectedShoppingStoreId() {
  return normaliseStoreId($("#shopping-item-store")?.value || state.household.shopping?.storeId);
}

function updateShoppingLineEstimate() {
  const preview = $("#shopping-line-estimate");
  if (!preview) return;
  const quantity = Math.max(1, Number($("#shopping-quantity")?.value) || 1);
  const price = Math.max(0, Number($("#shopping-cost")?.value) || 0);
  preview.innerHTML = `<span>${quantity} × ${groceryMoney(price)}</span><strong>${groceryMoney(quantity * price)} expected</strong>`;
}

function renderShoppingSuggestions(name) {
  const region = $("#shopping-product-suggestions");
  if (!region) return;
  const nameInput = $("#shopping-name");
  const shopping = state.household.shopping || {};
  const storeId = selectedShoppingStoreId();
  const suggestions = suggestShoppingProducts(name, storeId, shopping.priceMemory);
  region.hidden = !suggestions.length;
  if (nameInput) nameInput.setAttribute("aria-expanded", String(Boolean(suggestions.length)));
  region.innerHTML = suggestions.map((suggestion) => `<button type="button" data-action="select-shopping-suggestion" data-name="${escapeHTML(suggestion.name)}"><span>${escapeHTML(suggestion.name)}${suggestion.source === "memory" ? "<small>Saved product</small>" : ""}</span><strong>${groceryMoney(suggestion.price)}</strong></button>`).join("");
}

function updateShoppingEstimate({ force = false, hideSuggestions = false } = {}) {
  const nameInput = $("#shopping-name");
  const priceInput = $("#shopping-cost");
  const hint = $("#shopping-estimate-hint");
  if (!nameInput || !priceInput || !hint) return;
  const shopping = state.household.shopping || {};
  const storeId = selectedShoppingStoreId();
  if (!hideSuggestions) renderShoppingSuggestions(nameInput.value);
  else if ($("#shopping-product-suggestions")) $("#shopping-product-suggestions").hidden = true;

  if (priceInput.dataset.priceSource === "manual" && !force) {
    hint.textContent = `Your ${storeLabel(storeId)} price — saved for next time.`;
    updateShoppingLineEstimate();
    return;
  }
  const estimate = estimateShoppingPrice(nameInput.value, storeId, shopping.priceMemory);
  if (!estimate) {
    hint.textContent = `Type an item and Brady Budget will predict a ${storeLabel(storeId)} price.`;
    updateShoppingLineEstimate();
    return;
  }
  priceInput.value = estimate.price.toFixed(2);
  priceInput.dataset.priceSource = estimate.source;
  priceInput.dataset.priceKey = estimate.key;
  hint.textContent = `${estimate.description}. Edit it if your pack or shelf price differs.`;
  updateShoppingLineEstimate();
}

function markShoppingPriceManual() {
  const priceInput = $("#shopping-cost");
  const hint = $("#shopping-estimate-hint");
  if (!priceInput || !hint) return;
  priceInput.dataset.priceSource = "manual";
  hint.textContent = `Your ${storeLabel(selectedShoppingStoreId())} price — saved for next time.`;
  updateShoppingLineEstimate();
}

function shoppingBudgetModal() {
  openModal({
    title: "Set grocery budget",
    subtitle: "This shared target covers the estimated total of every item on the household list.",
    body: `<form data-form="shopping-budget"><div class="field"><label for="shopping-budget">Grocery budget</label><div class="money-input"><span>$</span><input id="shopping-budget" name="budget" type="number" min="0" step="1" value="${escapeHTML(state.household.shopping?.budget || "")}" placeholder="250" required /></div></div><div class="modal-actions"><button class="button secondary" type="button" data-action="close-modal">Cancel</button><button class="button" type="submit">Save budget</button></div></form>`,
  });
}

function shoppingItemModal(item = null) {
  const entry = item || { id: "", name: "", quantity: 1, estimatedCost: "", recurring: false };
  const selectedStoreId = normaliseStoreId(entry.storeId || state.household.shopping?.storeId);
  const selectedStore = storeLabel(selectedStoreId);
  openModal({
    title: item ? "Edit shopping item" : "Add to shopping list",
    subtitle: "Choose a store, then type what you need for a predictive guide price.",
    body: `<form data-form="shopping-item"><input type="hidden" name="id" value="${escapeHTML(entry.id)}" /><div class="form-grid">
      <div class="field full"><label for="shopping-item-store">Store</label><select id="shopping-item-store" name="storeId">${shoppingStoreOptions(selectedStoreId)}</select><small class="field-note">Each item can come from a different store.</small></div>
      <div class="field full predictive-field"><label for="shopping-name">Item</label><input id="shopping-name" name="name" value="${escapeHTML(entry.name)}" placeholder="Try milk, bread or eggs" role="combobox" aria-autocomplete="list" aria-controls="shopping-product-suggestions" aria-expanded="false" required /><div id="shopping-product-suggestions" class="product-suggestions" role="listbox" hidden></div></div>
      <div class="field"><label for="shopping-quantity">Quantity</label><input id="shopping-quantity" name="quantity" type="number" min="1" step="1" value="${escapeHTML(entry.quantity)}" required /></div>
      <div class="field"><label for="shopping-cost">Estimated price each</label><div class="money-input"><span>$</span><input id="shopping-cost" name="estimatedCost" type="number" min="0" step="0.01" value="${escapeHTML(entry.estimatedCost)}" placeholder="Filled automatically" aria-describedby="shopping-estimate-hint" required /></div><div class="estimate-hint-row"><small id="shopping-estimate-hint">Type an item to get a ${selectedStore} estimate.</small><button class="text-button" type="button" data-action="use-shopping-estimate">Use estimate</button></div></div>
      <div class="estimate-preview full" id="shopping-line-estimate"><span>1 × ${groceryMoney(entry.estimatedCost || 0)}</span><strong>${groceryMoney(entry.estimatedCost || 0)} expected</strong></div>
      <div class="field full"><label class="checkbox-field"><input name="recurring" type="checkbox" ${entry.recurring ? "checked" : ""} /><span><strong>Add every week</strong><small>This item returns unticked when a new shopping week starts on Monday.</small></span></label></div>
    </div><div class="modal-actions">${item ? `<button class="button ghost" type="button" data-action="delete-shopping-item" data-id="${escapeHTML(item.id)}">Delete</button>` : ""}<button class="button secondary" type="button" data-action="close-modal">Cancel</button><button class="button" type="submit">${item ? "Save item" : "Add item"}</button></div></form>`,
  });
  const priceInput = $("#shopping-cost");
  priceInput.dataset.priceSource = entry.priceSource || (item ? "manual" : "");
  priceInput.dataset.priceKey = entry.priceKey || "";
  if (entry.name && !entry.estimatedCost) updateShoppingEstimate({ force: true });
  else {
    updateShoppingLineEstimate();
    if (entry.name) renderShoppingSuggestions(entry.name);
  }
}

function profileModal() {
  openModal({
    title: "Profile & preferences",
    subtitle: "Monthly income is used for planning; transactions show what has actually arrived.",
    body: `<form data-form="profile"><div class="form-grid">
      <div class="field full"><label for="profile-name">First name</label><input id="profile-name" name="name" value="${escapeHTML(state.profile.name)}" required /></div>
      <div class="field"><label for="profile-income">Expected monthly income</label><div class="money-input"><span>$</span><input id="profile-income" name="monthlyIncome" type="number" min="0" step="1" value="${escapeHTML(state.profile.monthlyIncome)}" required /></div></div>
      <div class="field"><label for="profile-currency">Currency</label><select id="profile-currency" name="currency">${["AUD", "NZD", "USD", "GBP", "EUR", "CAD"].map((currency) => `<option value="${currency}" ${state.profile.currency === currency ? "selected" : ""}>${currency}</option>`).join("")}</select></div>
      <div class="field full"><label for="profile-theme">Appearance</label><select id="profile-theme" name="theme"><option value="system" ${state.profile.theme === "system" ? "selected" : ""}>Follow device</option><option value="light" ${state.profile.theme === "light" ? "selected" : ""}>Light</option><option value="dark" ${state.profile.theme === "dark" ? "selected" : ""}>Dark</option></select></div>
    </div><div class="modal-actions">${state.household.profiles.length > 1 ? `<button class="button ghost" type="button" data-action="remove-profile" data-id="${escapeHTML(state.household.activeProfileId)}">Remove profile</button>` : ""}<button class="button secondary" type="button" data-action="close-modal">Cancel</button><button class="button" type="submit">Save preferences</button></div></form>`,
  });
}

function profileSwitcherModal() {
  const profiles = state.household.profiles;
  openModal({
    title: "Household profiles",
    subtitle: "Choose whose individual budget you want to view. Both profiles are open to this household.",
    body: `<div class="profile-list">${profiles.map((profile) => {
      const active = profile.id === state.household.activeProfileId;
      return `<div class="profile-choice ${active ? "active" : ""}">
        <span class="profile-choice-avatar" style="background:${escapeHTML(profile.colour)}">${escapeHTML(profile.name.slice(0, 1).toUpperCase())}</span>
        <span class="profile-choice-copy"><strong>${escapeHTML(profile.name)}</strong><span>${moneyForProfile(profile.profile.monthlyIncome, profile.profile.currency)} expected monthly income</span></span>
        <button class="button small ${active ? "accent" : "secondary"}" type="button" data-action="select-profile" data-id="${escapeHTML(profile.id)}">${active ? "Viewing" : "Switch"}</button>
      </div>`;
    }).join("")}</div>
    <p class="profile-limit">Each profile has completely separate categories, transactions, bills and savings goals. Backups include both profiles.</p>
    <div class="modal-actions"><button class="button secondary" type="button" data-action="close-modal">Close</button>${profiles.length < PROFILE_LIMIT ? `<button class="button" type="button" data-action="add-profile">${icon("plus")} Add partner</button>` : ""}</div>`,
  });
}

function addProfileModal() {
  if (state.household.profiles.length >= PROFILE_LIMIT) return toast("Brady Budget supports two household profiles.", "error");
  openModal({
    title: "Add your partner",
    subtitle: "This creates a fresh, independent budget that either of you can select and view.",
    body: `<form data-form="add-profile"><div class="form-grid">
      <div class="field full"><label for="partner-name">First name</label><input id="partner-name" name="name" autocomplete="given-name" placeholder="Partner’s name" required /></div>
      <div class="field"><label for="partner-income">Take-home pay</label><div class="money-input"><span>$</span><input id="partner-income" name="income" type="number" min="0" step="0.01" placeholder="3000" required /></div></div>
      <div class="field"><label for="partner-cadence">How often?</label><select id="partner-cadence" name="cadence"><option value="weekly">Weekly</option><option value="fortnightly" selected>Fortnightly</option><option value="monthly">Monthly</option><option value="annual">Annually</option></select></div>
      <div class="field full"><label for="partner-template">Starting plan</label><select id="partner-template" name="template"><option value="balanced">Guided plan</option><option value="simple">Simple essentials</option><option value="blank">Blank slate</option></select><span class="hint">Every category can be changed later.</span></div>
    </div><div class="modal-actions"><button class="button secondary" type="button" data-action="manage-profiles">Back</button><button class="button" type="submit">Create profile</button></div></form>`,
  });
}

function moneyForProfile(value, currency = "AUD") {
  return formatCurrency(value, currency);
}

function csvImportModal() {
  pendingCSVTransactions = [];
  openModal({
    title: "Import bank CSV",
    subtitle: "Works with Date + Amount, or separate Debit and Credit columns. Positive amounts are treated as income; negative amounts as expenses.",
    body: `<form data-form="import-csv"><label class="drop-zone" for="csv-file">${icon("upload")}<strong>Choose a CSV file</strong><p>Common headings such as Date, Description, Amount, Debit and Credit are detected automatically.</p><input id="csv-file" type="file" accept=".csv,text/csv" required /></label><div id="csv-preview"></div><div class="modal-actions"><button class="button secondary" type="button" data-action="close-modal">Cancel</button><button class="button" id="csv-import-button" type="submit" disabled>Import transactions</button></div></form>`,
  });
}

function jsonImportModal() {
  openModal({
    title: "Restore a backup",
    subtitle: "This replaces the budget currently stored on this device.",
    body: `<form data-form="import-json"><label class="drop-zone" for="json-file">${icon("upload")}<strong>Choose a budget backup</strong><p>Select a .json file previously exported from Brady Budget or Harbour Budget.</p><input id="json-file" type="file" accept=".json,application/json" required /></label><div class="modal-actions"><button class="button secondary" type="button" data-action="close-modal">Cancel</button><button class="button" type="submit">Restore backup</button></div></form>`,
  });
}

function confirmModal({ title, copy, confirmLabel, action, danger = false, id = "" }) {
  openModal({
    title,
    body: `<p style="color:var(--ink-soft);font-size:.8rem;line-height:1.65">${copy}</p><div class="modal-actions"><button class="button secondary" type="button" data-action="close-modal">Cancel</button><button class="button ${danger ? "danger" : ""}" type="button" data-action="${action}" ${id ? `data-id="${escapeHTML(id)}"` : ""}>${confirmLabel}</button></div>`,
  });
}

function toast(message, type = "success") {
  while ($("#toast-region").children.length >= 2) $("#toast-region").firstElementChild.remove();
  const element = document.createElement("div");
  element.className = `toast ${type}`;
  element.innerHTML = `${icon(type === "error" ? "info" : "check")}<span>${escapeHTML(message)}</span>`;
  $("#toast-region").append(element);
  setTimeout(() => element.remove(), 3200);
}

function formNumber(data, key) {
  return Math.max(0, Number(data.get(key)) || 0);
}

async function handleSubmit(event) {
  const form = event.target.closest("form[data-form]");
  if (!form) return;
  event.preventDefault();
  const data = new FormData(form);
  const type = form.dataset.form;

  if (type === "period-picker") {
    setViewPeriod({
      kind: String(data.get("periodKind") || "monthly"),
      anchor: String(data.get("anchor") || toLocalISO()),
    });
    closeModal();
    renderApp();
    toast(`Showing the ${viewPeriod.kind} budget.`);
    return;
  }
  if (type === "onboarding-profile") {
    state.profile.name = String(data.get("name")).trim();
    state.profile.payCadence = String(data.get("cadence"));
    state.profile.monthlyIncome = Math.round(normalizeIncome(data.get("income"), data.get("cadence")));
    onboardingStep = 2;
    renderOnboarding();
    return;
  }
  if (type === "onboarding-template") {
    state = applyTemplate(state, data.get("template"));
    state.profile.onboarded = true;
    state.profile.demoMode = false;
    persist("Your budget is ready.");
    return;
  }
  if (type === "transaction") {
    const id = String(data.get("id"));
    const transaction = {
      id: id || uid("txn"),
      type: String(data.get("type")),
      name: String(data.get("name")).trim(),
      amount: formNumber(data, "amount"),
      date: String(data.get("date")),
      categoryId: String(data.get("categoryId")),
      note: String(data.get("note") || "").trim(),
      cleared: true,
      createdAt: id ? state.transactions.find((item) => item.id === id)?.createdAt : new Date().toISOString(),
    };
    if (id) state.transactions = state.transactions.map((item) => item.id === id ? transaction : item);
    else state.transactions.unshift(transaction);
    closeModal();
    persist(id ? "Transaction updated." : "Transaction added.");
    return;
  }
  if (type === "category") {
    const id = String(data.get("id"));
    const existing = state.categories.find((item) => item.id === id);
    const category = {
      ...(existing || {}),
      id: id || uid("category"),
      name: String(data.get("name")).trim(),
      icon: String(data.get("icon")).trim(),
      group: String(data.get("group")),
      budget: formNumber(data, "budget"),
      colour: GROUPS[String(data.get("group"))]?.colour,
      archived: false,
    };
    if (id) state.categories = state.categories.map((item) => item.id === id ? category : item);
    else state.categories.push(category);
    closeModal();
    persist("Category saved.");
    return;
  }
  if (type === "goal") {
    const id = String(data.get("id"));
    const goal = {
      id: id || uid("goal"),
      name: String(data.get("name")).trim(),
      icon: String(data.get("icon")).trim(),
      target: formNumber(data, "target"),
      saved: formNumber(data, "saved"),
      monthlyContribution: formNumber(data, "monthlyContribution"),
      targetDate: String(data.get("targetDate") || ""),
      colour: state.goals.find((item) => item.id === id)?.colour || ["#9184c8", "#ff8f70", "#79b8be"][state.goals.length % 3],
      archived: false,
    };
    if (id) state.goals = state.goals.map((item) => item.id === id ? goal : item);
    else state.goals.push(goal);
    closeModal();
    persist("Savings goal saved.");
    return;
  }
  if (type === "contribution") {
    const goal = state.goals.find((item) => item.id === data.get("id"));
    if (goal) goal.saved = Math.min(Number(goal.target) || Infinity, (Number(goal.saved) || 0) + formNumber(data, "amount"));
    closeModal();
    persist("Contribution added.");
    return;
  }
  if (type === "bill") {
    const id = String(data.get("id"));
    const existing = state.bills.find((item) => item.id === id);
    const partner = state.household.profiles.find((profile) => profile.id !== state.household.activeProfileId);
    const shared = data.get("sharing") === "shared" && Boolean(partner);
    const total = formNumber(data, "amount");
    const ownShare = shared ? formNumber(data, "yourShare") : total;
    if (shared && ownShare > total) return toast("Your share cannot be more than the total bill.", "error");
    const split = splitBillAmount(total, ownShare);
    const partnerShare = split.second;
    const sharedGroupId = shared ? (existing?.sharedGroupId || uid("shared-bill")) : "";
    const bill = {
      id: id || uid("bill"),
      name: String(data.get("name")).trim(),
      amount: ownShare,
      nextDue: String(data.get("nextDue")),
      frequency: String(data.get("frequency")),
      categoryId: String(data.get("categoryId")),
      autopay: data.get("autopay") === "on",
      active: true,
      shared,
      ...(shared ? { sharedGroupId, sharedTotal: total, sharedPartnerAmount: partnerShare, sharedWithProfileId: partner.id } : {}),
    };
    if (id) state.bills = state.bills.map((item) => item.id === id ? bill : item);
    else state.bills.push(bill);
    state = syncActiveProfile(state);
    const activeId = state.household.activeProfileId;
    const previousGroupId = existing?.sharedGroupId;
    state.household.profiles = state.household.profiles.map((profile) => {
      if (profile.id === activeId) return profile;
      let bills = profile.bills.filter((item) => !previousGroupId || item.sharedGroupId !== previousGroupId);
      if (shared && profile.id === partner.id) {
        const counterpart = profile.bills.find((item) => item.sharedGroupId === sharedGroupId);
        const partnerCategory = profile.categories.some((category) => category.id === bill.categoryId) ? bill.categoryId : "uncategorised";
        bills.push({
          ...bill,
          id: counterpart?.id || uid("bill"),
          amount: partnerShare,
          categoryId: counterpart?.categoryId || partnerCategory,
          sharedPartnerAmount: ownShare,
          sharedWithProfileId: activeId,
        });
      }
      return { ...profile, bills };
    });
    state = activateProfile(state, activeId, { syncCurrent: false });
    closeModal();
    persist(shared ? `Bill split ${money(ownShare)} / ${money(partnerShare)}.` : "Recurring bill saved.");
    return;
  }
  if (type === "shopping-budget") {
    state.household.shopping = { ...state.household.shopping, budget: formNumber(data, "budget") };
    closeModal();
    persist("Shared grocery budget saved.");
    return;
  }
  if (type === "shopping-item") {
    const id = String(data.get("id"));
    const shopping = state.household.shopping;
    const existing = shopping.items.find((item) => item.id === id);
    const storeId = normaliseStoreId(data.get("storeId") || shopping.storeId);
    const priceInput = $("#shopping-cost", form);
    const priceSource = priceInput?.dataset.priceSource || "manual";
    const name = String(data.get("name")).trim();
    const estimatedCost = formNumber(data, "estimatedCost");
    const item = {
      id: id || uid("shop"),
      name,
      quantity: Math.max(1, Math.round(formNumber(data, "quantity"))),
      estimatedCost,
      storeId,
      priceSource,
      priceKey: priceInput?.dataset.priceKey || "",
      checked: existing?.checked || false,
      recurring: data.get("recurring") === "on",
      addedByProfileId: existing?.addedByProfileId || state.household.activeProfileId,
      createdAt: existing?.createdAt || new Date().toISOString(),
      weekAdded: existing?.weekAdded || shopping.weekKey,
    };
    const items = id
      ? shopping.items.map((entry) => entry.id === id ? item : entry)
      : [...shopping.items, item];
    const priceMemory = priceSource === "manual"
      ? rememberShoppingPrice(shopping.priceMemory, storeId, name, estimatedCost)
      : shopping.priceMemory;
    state.household.shopping = { ...shopping, storeId, items, priceMemory };
    closeModal();
    persist(id ? "Shopping item updated." : "Added to the shared list.");
    return;
  }
  if (type === "profile") {
    state.profile.name = String(data.get("name")).trim();
    state.profile.monthlyIncome = formNumber(data, "monthlyIncome");
    state.profile.currency = String(data.get("currency"));
    state.profile.theme = String(data.get("theme"));
    state.profile.demoMode = false;
    closeModal();
    persist("Preferences saved.");
    return;
  }
  if (type === "add-profile") {
    if (state.household.profiles.length >= PROFILE_LIMIT) return toast("Brady Budget supports two household profiles.", "error");
    const name = String(data.get("name")).trim();
    const cadence = String(data.get("cadence"));
    let partnerBudget = baseState();
    partnerBudget.profile = {
      ...partnerBudget.profile,
      name,
      currency: state.profile.currency,
      theme: state.profile.theme,
      payCadence: cadence,
      monthlyIncome: Math.round(normalizeIncome(data.get("income"), cadence)),
      onboarded: true,
      demoMode: false,
    };
    partnerBudget = applyTemplate(partnerBudget, String(data.get("template")));
    const id = uid("profile");
    const partner = createProfileRecord(partnerBudget, {
      id,
      name,
      colour: PROFILE_COLOURS[state.household.profiles.length % PROFILE_COLOURS.length],
    });
    state = syncActiveProfile(state);
    state.household = { ...state.household, profiles: [...state.household.profiles, partner] };
    state = activateProfile(state, id, { syncCurrent: false });
    closeModal();
    location.hash = "overview";
    persist(`${name}’s profile is ready.`);
    return;
  }
  if (type === "import-csv") {
    if (!pendingCSVTransactions.length) return toast("Choose a valid CSV first.", "error");
    state.transactions = [...pendingCSVTransactions, ...state.transactions];
    const count = pendingCSVTransactions.length;
    closeModal();
    persist(`${count} transaction${count === 1 ? "" : "s"} imported.`);
    return;
  }
  if (type === "import-json") {
    const file = $("#json-file")?.files?.[0];
    if (!file) return toast("Choose a backup file.", "error");
    try {
      const candidate = JSON.parse(await file.text());
      validateState(candidate);
      const restored = { ...baseState(), ...candidate, household: candidate.household || null, profile: { ...baseState().profile, ...candidate.profile, onboarded: true } };
      state = ensureHousehold(restored);
      closeModal();
      persist("Backup restored.");
    } catch (error) {
      toast(error.message || "Could not restore that backup.", "error");
    }
  }
}

async function handleFileChange(event) {
  if (event.target.id !== "csv-file") return;
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    pendingCSVTransactions = parseBankCSV(await file.text(), state.categories);
    $("#csv-preview").innerHTML = `<div class="notice" style="margin:15px 0 0">${icon("check")}<span>${pendingCSVTransactions.length} transaction${pendingCSVTransactions.length === 1 ? "" : "s"} ready to import.</span></div><div class="import-preview">${pendingCSVTransactions.slice(0, 5).map((transaction) => `<div class="preview-row"><span>${escapeHTML(transaction.date)}</span><span>${escapeHTML(transaction.name)}</span><strong>${transaction.type === "income" ? "+" : "−"}${money(transaction.amount)}</strong></div>`).join("")}</div>`;
    $("#csv-import-button").disabled = !pendingCSVTransactions.length;
  } catch (error) {
    pendingCSVTransactions = [];
    $("#csv-preview").innerHTML = `<div class="notice warning" style="margin:15px 0 0">${icon("info")}<span>${escapeHTML(error.message)}</span></div>`;
    $("#csv-import-button").disabled = true;
  }
}

function filterTransactions() {
  const query = ($("#transaction-search")?.value || "").trim().toLowerCase();
  const category = $("#transaction-filter")?.value || "all";
  $$(".transaction-row", $("#activity-list")).forEach((row) => {
    const searchMatch = !query || row.dataset.search.includes(query);
    const categoryMatch = category === "all" || row.dataset.category === category;
    row.hidden = !(searchMatch && categoryMatch);
  });
  $$(".transaction-date-group", $("#activity-list")).forEach((group) => {
    group.hidden = !$$(`.transaction-row:not([hidden])`, group).length;
  });
}

function handleClick(event) {
  const button = event.target.closest("[data-action]");
  if (!button) return;
  const action = button.dataset.action;
  const id = button.dataset.id;
  if (action === "close-modal") {
    if (event.target.closest("[data-modal-panel]") && !event.target.closest(".modal-close, [data-action='close-modal']:not(.modal-backdrop)")) return;
    closeModal();
  } else if (action === "onboarding-next") { onboardingStep = 1; renderOnboarding(); }
  else if (action === "onboarding-back") { onboardingStep = Math.max(0, onboardingStep - 1); renderOnboarding(); }
  else if (action === "load-demo-direct") { state = demoState(); persist("Sample budget loaded."); }
  else if (action === "start-fresh") confirmModal({ title: "Start with a clean budget?", copy: "This replaces the sample with a fresh setup. Export a backup first if you changed anything you want to keep.", confirmLabel: "Start fresh", action: "confirm-start-fresh" });
  else if (action === "confirm-start-fresh") { state = baseState(); onboardingStep = 1; clearState(); closeModal(); persist("Started a clean household budget."); }
  else if (action === "go-plan") location.hash = "plan";
  else if (action === "go-activity") location.hash = "activity";
  else if (action === "go-goals") location.hash = "goals";
  else if (action === "dismiss-household-notice") {
    try {
      localStorage.setItem(HOUSEHOLD_NOTICE_DISMISSED_KEY, "yes");
    } catch {
      // The notice can still close for this visit if device storage is unavailable.
    }
    button.closest(".notice")?.remove();
  }
  else if (action === "switch-profile" || action === "manage-profiles") profileSwitcherModal();
  else if (action === "add-profile") addProfileModal();
  else if (action === "select-profile") {
    if (id === state.household.activeProfileId) closeModal();
    else {
      const selected = state.household.profiles.find((profile) => profile.id === id);
      state = activateProfile(state, id);
      closeModal();
      location.hash = "overview";
      persist(`Now viewing ${selected?.name || "profile"}’s budget.`);
    }
  }
  else if (action === "remove-profile") {
    const profile = state.household.profiles.find((item) => item.id === id);
    if (profile && state.household.profiles.length > 1) confirmModal({ title: `Remove ${escapeHTML(profile.name)}’s profile?`, copy: "This permanently removes this profile’s transactions, bills, goals and plan from this device. Export a backup first if you may need it later.", confirmLabel: "Remove profile", action: "confirm-remove-profile", danger: true, id });
  }
  else if (action === "confirm-remove-profile") {
    if (state.household.profiles.length > 1) {
      state = syncActiveProfile(state);
      const profiles = state.household.profiles
        .filter((profile) => profile.id !== id)
        .map((profile) => ({ ...profile, bills: profile.bills.map((bill) => bill.sharedWithProfileId === id ? makeBillIndividual(bill) : bill) }));
      state = { ...state, household: { ...state.household, activeProfileId: profiles[0].id, profiles } };
      state = activateProfile(state, profiles[0].id, { syncCurrent: false });
      closeModal();
      location.hash = "overview";
      persist("Profile removed.");
    }
  }
  else if (action === "add-transaction") transactionModal();
  else if (action === "edit-transaction") transactionModal(state.transactions.find((item) => item.id === id));
  else if (action === "delete-transaction") {
    confirmModal({ title: "Delete this transaction?", copy: "This will immediately remove it from the monthly totals.", confirmLabel: "Delete", action: "confirm-delete-transaction", danger: true });
    $("[data-action='confirm-delete-transaction']")?.setAttribute("data-id", id);
  }
  else if (action === "confirm-delete-transaction") { state.transactions = state.transactions.filter((item) => item.id !== id); closeModal(); persist("Transaction deleted."); }
  else if (action === "add-category") categoryModal();
  else if (action === "edit-category") categoryModal(categoryById(id));
  else if (action === "archive-category") { const category = categoryById(id); if (category) category.archived = true; closeModal(); persist("Category archived."); }
  else if (action === "add-goal") goalModal();
  else if (action === "edit-goal") goalModal(state.goals.find((item) => item.id === id));
  else if (action === "contribute-goal") contributionModal(state.goals.find((item) => item.id === id));
  else if (action === "archive-goal") { const goal = state.goals.find((item) => item.id === id); if (goal) goal.archived = true; closeModal(); persist("Goal archived."); }
  else if (action === "add-bill") billModal();
  else if (action === "edit-bill") billModal(state.bills.find((item) => item.id === id));
  else if (action === "delete-bill") deleteBill(id);
  else if (action === "pay-bill") markBillPaid(id);
  else if (action === "set-shopping-budget") shoppingBudgetModal();
  else if (action === "add-shopping-item") shoppingItemModal();
  else if (action === "use-shopping-estimate") updateShoppingEstimate({ force: true });
  else if (action === "select-shopping-suggestion") {
    const nameInput = $("#shopping-name");
    const priceInput = $("#shopping-cost");
    if (nameInput && priceInput) {
      nameInput.value = button.dataset.name || nameInput.value;
      priceInput.dataset.priceSource = "";
      updateShoppingEstimate({ force: true, hideSuggestions: true });
    }
  }
  else if (action === "edit-shopping-item") shoppingItemModal(state.household.shopping.items.find((item) => item.id === id));
  else if (action === "toggle-shopping-item") {
    state.household.shopping.items = state.household.shopping.items.map((item) => item.id === id ? { ...item, checked: !item.checked } : item);
    persist();
  }
  else if (action === "delete-shopping-item") {
    state.household.shopping.items = state.household.shopping.items.filter((item) => item.id !== id);
    closeModal();
    persist("Shopping item removed.");
  }
  else if (action === "edit-profile") profileModal();
  else if (action === "import-csv") csvImportModal();
  else if (action === "import-json") jsonImportModal();
  else if (action === "export-json") exportJSON();
  else if (action === "export-csv") exportCSV();
  else if (action === "load-demo") confirmModal({ title: "Load sample budget?", copy: "This replaces the current budget on this device. Export a backup first if you need to keep it.", confirmLabel: "Load sample", action: "confirm-load-demo" });
  else if (action === "confirm-load-demo") { state = demoState(); closeModal(); persist("Sample budget loaded."); }
  else if (action === "reset-data") confirmModal({ title: "Reset the household budget?", copy: "This replaces the synced budget for both phones. Export a backup first if you may need the current data.", confirmLabel: "Reset household", action: "confirm-reset", danger: true });
  else if (action === "confirm-reset") { clearState(); state = baseState(); onboardingStep = 0; closeModal(); persist("Household budget reset."); }
  else if (action === "install-app") installApp();
}

function markBillPaid(id) {
  const bill = state.bills.find((item) => item.id === id);
  if (!bill) return;
  state.transactions.unshift({
    id: uid("txn"),
    type: "expense",
    name: bill.name,
    amount: Number(bill.amount),
    date: bill.nextDue,
    categoryId: bill.categoryId,
    note: "Created from recurring bill",
    cleared: true,
    createdAt: new Date().toISOString(),
  });
  bill.nextDue = advanceBillDate(bill.nextDue, bill.frequency);
  persist(`${bill.name} marked paid.`);
}

function deleteBill(id) {
  const bill = state.bills.find((item) => item.id === id);
  if (!bill) return;
  state.bills = state.bills.filter((item) => item.id !== id);
  if (bill.sharedGroupId) {
    state = syncActiveProfile(state);
    const activeId = state.household.activeProfileId;
    state.household.profiles = state.household.profiles.map((profile) => ({
      ...profile,
      bills: profile.bills.filter((item) => item.sharedGroupId !== bill.sharedGroupId),
    }));
    state = activateProfile(state, activeId, { syncCurrent: false });
  }
  closeModal();
  persist(bill.shared ? "Shared bill removed from both profiles." : "Bill deleted.");
}

function makeBillIndividual(bill) {
  const sharedKeys = new Set(["sharedGroupId", "sharedTotal", "sharedPartnerAmount", "sharedWithProfileId"]);
  const individual = Object.fromEntries(Object.entries(bill).filter(([key]) => !sharedKeys.has(key)));
  return { ...individual, shared: false };
}

function exportJSON() {
  state = saveState(state);
  const date = toLocalISO();
  downloadFile(`brady-budget-backup-${date}.json`, JSON.stringify(state, null, 2));
  toast("Backup downloaded.");
}

function exportCSV() {
  const profileSlug = (state.profile.name || "profile").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  downloadFile(`brady-budget-${profileSlug}-transactions-${toLocalISO()}.csv`, transactionsToCSV(state.transactions), "text/csv;charset=utf-8");
  toast("Transactions exported.");
}

async function installApp() {
  if (!deferredInstallPrompt) return;
  deferredInstallPrompt.prompt();
  await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = null;
  renderApp();
}

function init() {
  if (!location.hash) history.replaceState(null, "", "#overview");
  document.addEventListener("click", handleClick);
  document.addEventListener("submit", handleSubmit);
  document.addEventListener("change", (event) => {
    handleFileChange(event);
    if (event.target.id === "transaction-filter") filterTransactions();
    if (event.target.id === "bill-sharing") updateBillSplitPreview();
    if (event.target.name === "periodKind") updatePeriodPreview();
    if (event.target.id === "shopping-item-store") {
      const priceInput = $("#shopping-cost");
      if (priceInput) priceInput.dataset.priceSource = "";
      updateShoppingEstimate({ force: true });
    }
  });
  document.addEventListener("input", (event) => {
    if (event.target.id === "transaction-search") filterTransactions();
    if (["bill-amount", "bill-your-share"].includes(event.target.id)) updateBillSplitPreview();
    if (event.target.id === "shopping-name") updateShoppingEstimate();
    if (event.target.id === "shopping-quantity") updateShoppingLineEstimate();
    if (event.target.id === "shopping-cost") markShoppingPriceManual();
    if (event.target.id === "period-anchor") updatePeriodPreview();
  });
  document.addEventListener("focusin", (event) => {
    if (event.target.id === "shopping-name") renderShoppingSuggestions(event.target.value);
  });
  $("#how-to-control").addEventListener("click", howToGuideModal);
  $("#month-control").addEventListener("click", budgetPeriodModal);
  $("#profile-button").addEventListener("click", profileSwitcherModal);
  $("#quick-add").addEventListener("click", () => activeView() === "shopping" ? shoppingItemModal() : transactionModal());
  addEventListener("hashchange", () => {
    renderApp();
    $("#main-content").focus({ preventScroll: true });
    scrollTo({ top: 0, behavior: "smooth" });
  });
  addEventListener("keydown", (event) => { if (event.key === "Escape") closeModal(); });
  addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredInstallPrompt = event;
    if (activeView() === "more") renderApp();
  });
  matchMedia("(prefers-color-scheme: dark)").addEventListener?.("change", applyTheme);
  addEventListener("storage", (event) => {
    if (event.key === STORAGE_KEY && event.newValue) {
      state = loadState();
      renderApp();
    }
  });
  if ("serviceWorker" in navigator && location.protocol !== "file:") {
    addEventListener("load", () => navigator.serviceWorker.register("./sw.js").catch((error) => console.warn("Service worker registration failed", error)));
  }
  renderApp();
  void initialiseRemoteSync({
    onState(nextState, detail) {
      state = ensureHousehold(nextState);
      renderApp();
      if (detail?.source === "remote") toast("Household changes updated.");
    },
    onStatus(status) {
      if (["live", "offline", "reconnecting", "updated"].includes(status)) document.body.classList.remove("auth-pending");
      if (status === "updated") toast("Household changes updated.");
      if (activeView() === "more") updateVisibleSyncStatus();
    },
  });
}

init();
