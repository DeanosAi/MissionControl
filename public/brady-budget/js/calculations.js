export const APP_VERSION = 2;

export function uid(prefix = "item") {
  const random = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${prefix}-${random}`;
}

export function toLocalISO(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function monthKey(date = new Date()) {
  return toLocalISO(date).slice(0, 7);
}

export function parseLocalDate(value) {
  if (value instanceof Date) return new Date(value.getFullYear(), value.getMonth(), value.getDate());
  const [year, month, day = 1] = String(value).split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function shiftMonth(key, amount) {
  const date = parseLocalDate(`${key}-01`);
  date.setMonth(date.getMonth() + amount);
  return monthKey(date);
}

export function monthLabel(key, locale = "en-AU", short = false) {
  return new Intl.DateTimeFormat(locale, { month: short ? "short" : "long", year: "numeric" }).format(parseLocalDate(`${key}-01`));
}

export const PERIOD_KINDS = ["weekly", "fortnightly", "monthly"];

export function normalisePeriodSelection(selection, fallbackMonth = monthKey()) {
  if (typeof selection === "string") {
    const anchor = /^\d{4}-\d{2}$/.test(selection) ? `${selection}-01` : selection;
    return { kind: "monthly", anchor };
  }
  const kind = PERIOD_KINDS.includes(selection?.kind) ? selection.kind : "monthly";
  const anchor = /^\d{4}-\d{2}-\d{2}$/.test(String(selection?.anchor || ""))
    ? String(selection.anchor)
    : `${fallbackMonth}-01`;
  return { kind, anchor };
}

export function periodScale(kind = "monthly") {
  return kind === "weekly" ? 12 / 52 : kind === "fortnightly" ? 12 / 26 : 1;
}

export function periodBounds(selection = {}) {
  const normalised = normalisePeriodSelection(selection);
  const anchorDate = parseLocalDate(normalised.anchor);
  const startDate = new Date(anchorDate);
  const endDate = new Date(anchorDate);

  if (normalised.kind === "monthly") {
    startDate.setDate(1);
    endDate.setMonth(endDate.getMonth() + 1, 0);
  } else {
    const day = startDate.getDay();
    startDate.setDate(startDate.getDate() - (day === 0 ? 6 : day - 1));
    endDate.setTime(startDate.getTime());
    endDate.setDate(endDate.getDate() + (normalised.kind === "fortnightly" ? 13 : 6));
  }

  return {
    kind: normalised.kind,
    anchor: toLocalISO(anchorDate),
    start: toLocalISO(startDate),
    end: toLocalISO(endDate),
    startDate,
    endDate,
    days: Math.round((endDate - startDate) / 86_400_000) + 1,
    scale: periodScale(normalised.kind),
  };
}

export function periodNoun(kind = "monthly") {
  return kind === "weekly" ? "week" : kind === "fortnightly" ? "fortnight" : "month";
}

export function periodTitle(kind = "monthly") {
  return kind === "weekly" ? "Weekly" : kind === "fortnightly" ? "Fortnightly" : "Monthly";
}

export function periodLabel(selection, locale = "en-AU", short = false) {
  const period = periodBounds(selection);
  if (period.kind === "monthly") return monthLabel(period.start.slice(0, 7), locale, short);

  const start = period.startDate;
  const end = period.endDate;
  const sameYear = start.getFullYear() === end.getFullYear();
  const sameMonth = sameYear && start.getMonth() === end.getMonth();
  const monthStyle = short ? "short" : "long";
  const format = (date, options) => new Intl.DateTimeFormat(locale, options).format(date);

  if (short) {
    if (sameMonth) return `${start.getDate()}–${format(end, { day: "numeric", month: monthStyle })}`;
    if (sameYear) return `${format(start, { day: "numeric", month: monthStyle })}–${format(end, { day: "numeric", month: monthStyle })}`;
    return `${format(start, { day: "numeric", month: monthStyle, year: "numeric" })}–${format(end, { day: "numeric", month: monthStyle, year: "numeric" })}`;
  }

  if (sameMonth) return `${start.getDate()}–${format(end, { day: "numeric", month: monthStyle, year: "numeric" })}`;
  if (sameYear) return `${format(start, { day: "numeric", month: monthStyle })} – ${format(end, { day: "numeric", month: monthStyle, year: "numeric" })}`;
  return `${format(start, { day: "numeric", month: monthStyle, year: "numeric" })} – ${format(end, { day: "numeric", month: monthStyle, year: "numeric" })}`;
}

export function scaleMonthlyAmount(amount, kind = "monthly") {
  return (Number(amount) || 0) * periodScale(kind);
}

export function recurringAmountForPeriod(amount, frequency = "monthly", kind = "monthly") {
  const monthlyOccurrences = { weekly: 52 / 12, fortnightly: 26 / 12, monthly: 1, quarterly: 1 / 3, yearly: 1 / 12 };
  return Math.max(0, Number(amount) || 0) * (monthlyOccurrences[frequency] ?? 1) * periodScale(kind);
}

export function formatCurrency(amount, currency = "AUD", options = {}) {
  const { compact = false, maximumFractionDigits = 0 } = options;
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency,
    notation: compact ? "compact" : "standard",
    maximumFractionDigits,
  }).format(Number(amount) || 0);
}

export function formatDate(value, options = {}) {
  return new Intl.DateTimeFormat("en-AU", options).format(parseLocalDate(value));
}

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function normalizeIncome(amount, cadence = "monthly") {
  const value = Math.max(0, Number(amount) || 0);
  const factors = { weekly: 52 / 12, fortnightly: 26 / 12, monthly: 1, annual: 1 / 12 };
  return value * (factors[cadence] ?? 1);
}

export function splitBillAmount(totalAmount, firstShare) {
  const total = Math.max(0, Number(totalAmount) || 0);
  const first = clamp(Math.max(0, Number(firstShare) || 0), 0, total);
  return { total, first, second: total - first };
}

export function calculateShoppingList(items = [], budget = 0) {
  const estimatedTotal = items.reduce((sum, item) => {
    const quantity = Math.max(1, Number(item.quantity) || 1);
    const estimatedCost = Math.max(0, Number(item.estimatedCost) || 0);
    return sum + (quantity * estimatedCost);
  }, 0);
  const target = Math.max(0, Number(budget) || 0);
  return {
    estimatedTotal,
    budget: target,
    remaining: target - estimatedTotal,
    percent: target ? (estimatedTotal / target) * 100 : 0,
  };
}

export function transactionsForMonth(transactions = [], key) {
  return transactions.filter((transaction) => String(transaction.date).slice(0, 7) === key);
}

export function transactionsForPeriod(transactions = [], selection = {}) {
  const period = periodBounds(selection);
  return transactions.filter((transaction) => {
    const date = String(transaction.date).slice(0, 10);
    return date >= period.start && date <= period.end;
  });
}

export function spendByCategory(transactions = [], selection = {}) {
  return transactionsForPeriod(transactions, selection)
    .filter((transaction) => transaction.type === "expense" && !transaction.excluded)
    .reduce((totals, transaction) => {
      const categoryId = transaction.categoryId || "uncategorised";
      totals[categoryId] = (totals[categoryId] || 0) + Math.abs(Number(transaction.amount) || 0);
      return totals;
    }, {});
}

export function calculateBudget(state, selection = { kind: "monthly", anchor: `${state.currentMonth}-01` }) {
  const period = periodBounds(normalisePeriodSelection(selection, state.currentMonth));
  const categories = state.categories.filter((category) => !category.archived);
  const periodTransactions = transactionsForPeriod(state.transactions, period).filter((transaction) => !transaction.excluded);
  const spending = spendByCategory(state.transactions, period);
  const expenseTotal = periodTransactions
    .filter((transaction) => transaction.type === "expense")
    .reduce((sum, transaction) => sum + Math.abs(Number(transaction.amount) || 0), 0);
  const incomeReceived = periodTransactions
    .filter((transaction) => transaction.type === "income")
    .reduce((sum, transaction) => sum + Math.abs(Number(transaction.amount) || 0), 0);
  const expectedIncome = scaleMonthlyAmount(state.profile.monthlyIncome, period.kind);
  const categoryBudget = categories.reduce((sum, category) => sum + scaleMonthlyAmount(Math.max(0, Number(category.budget) || 0), period.kind), 0);
  const goalContributions = state.goals
    .filter((goal) => !goal.archived)
    .reduce((sum, goal) => sum + scaleMonthlyAmount(Math.max(0, Number(goal.monthlyContribution) || 0), period.kind), 0);
  const fixedCategories = categories.filter((category) => category.group === "fixed");
  const fixedBudget = fixedCategories.reduce((sum, category) => sum + scaleMonthlyAmount(Math.max(0, Number(category.budget) || 0), period.kind), 0);
  const fixedSpent = fixedCategories.reduce((sum, category) => sum + (spending[category.id] || 0), 0);
  const variableSpent = expenseTotal - fixedSpent;
  const fixedReserve = Math.max(fixedBudget, fixedSpent);
  const safeToSpend = expectedIncome - fixedReserve - goalContributions - variableSpent;
  const readyToAssign = expectedIncome - categoryBudget - goalContributions;
  const categoryRows = categories.map((category) => {
    const spent = spending[category.id] || 0;
    const budget = scaleMonthlyAmount(Math.max(0, Number(category.budget) || 0), period.kind);
    return { ...category, spent, remaining: budget - spent, percent: budget ? (spent / budget) * 100 : spent ? 100 : 0 };
  });
  const today = new Date();
  const todayKey = toLocalISO(today);
  const isCurrentPeriod = todayKey >= period.start && todayKey <= period.end;
  const daysLeft = isCurrentPeriod
    ? Math.max(1, Math.round((period.endDate - parseLocalDate(todayKey)) / 86_400_000) + 1)
    : period.days;

  return {
    period,
    expectedIncome,
    incomeReceived,
    expenseTotal,
    categoryBudget,
    goalContributions,
    fixedBudget,
    fixedSpent,
    fixedReserve,
    variableSpent,
    safeToSpend,
    dailySafe: safeToSpend / daysLeft,
    readyToAssign,
    daysLeft,
    isCurrentPeriod,
    categoryRows,
    spending,
    spentPercent: expectedIncome ? (expenseTotal / expectedIncome) * 100 : 0,
  };
}

export function advanceBillDate(dateValue, frequency = "monthly") {
  const date = parseLocalDate(dateValue);
  if (frequency === "weekly") date.setDate(date.getDate() + 7);
  else if (frequency === "fortnightly") date.setDate(date.getDate() + 14);
  else if (frequency === "quarterly") date.setMonth(date.getMonth() + 3);
  else if (frequency === "yearly") date.setFullYear(date.getFullYear() + 1);
  else date.setMonth(date.getMonth() + 1);
  return toLocalISO(date);
}

export function upcomingBills(bills = [], from = new Date(), limitDays = 40) {
  const start = parseLocalDate(from);
  const end = new Date(start);
  end.setDate(end.getDate() + limitDays);
  return bills
    .filter((bill) => bill.active !== false && bill.nextDue)
    .filter((bill) => {
      const due = parseLocalDate(bill.nextDue);
      return due >= start && due <= end;
    })
    .sort((a, b) => String(a.nextDue).localeCompare(String(b.nextDue)));
}

export function goalProjection(goal) {
  const remaining = Math.max(0, (Number(goal.target) || 0) - (Number(goal.saved) || 0));
  const contribution = Math.max(0, Number(goal.monthlyContribution) || 0);
  const months = contribution ? Math.ceil(remaining / contribution) : null;
  const projected = new Date();
  if (months !== null) projected.setMonth(projected.getMonth() + months);
  return { remaining, months, projectedDate: months === null ? null : toLocalISO(projected) };
}

function detectDelimiter(line) {
  const candidates = [",", ";", "\t"];
  return candidates.sort((a, b) => line.split(b).length - line.split(a).length)[0];
}

function parseCSVLine(line, delimiter) {
  const fields = [];
  let value = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"') {
      if (quoted && line[index + 1] === '"') {
        value += '"';
        index += 1;
      } else quoted = !quoted;
    } else if (character === delimiter && !quoted) {
      fields.push(value.trim());
      value = "";
    } else value += character;
  }
  fields.push(value.trim());
  return fields;
}

function normaliseHeader(header) {
  return String(header).toLowerCase().replace(/[^a-z0-9]/g, "");
}

function parseAmount(value) {
  const cleaned = String(value ?? "").replace(/[,$£€\s]/g, "").replace(/^\((.*)\)$/, "-$1");
  const number = Number(cleaned);
  return Number.isFinite(number) ? number : 0;
}

function parseDateValue(value) {
  const raw = String(value ?? "").trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  const match = raw.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})$/);
  if (match) {
    const year = match[3].length === 2 ? 2000 + Number(match[3]) : Number(match[3]);
    return `${year}-${String(match[2]).padStart(2, "0")}-${String(match[1]).padStart(2, "0")}`;
  }
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? toLocalISO() : toLocalISO(parsed);
}

export function parseBankCSV(text, categories = []) {
  const lines = String(text).replace(/^\uFEFF/, "").split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) throw new Error("The CSV needs a header row and at least one transaction.");
  const delimiter = detectDelimiter(lines[0]);
  const headers = parseCSVLine(lines[0], delimiter).map(normaliseHeader);
  const indexOf = (...names) => headers.findIndex((header) => names.includes(header));
  const indexes = {
    date: indexOf("date", "transactiondate", "valuedate", "posteddate"),
    description: indexOf("description", "details", "transactiondescription", "narrative", "merchant", "payee", "memo"),
    amount: indexOf("amount", "transactionamount"),
    debit: indexOf("debit", "withdrawal", "withdrawals"),
    credit: indexOf("credit", "deposit", "deposits"),
    category: indexOf("category", "type"),
  };
  if (indexes.date < 0 || (indexes.amount < 0 && indexes.debit < 0 && indexes.credit < 0)) {
    throw new Error("Could not find Date and Amount columns. Use Date, Description and Amount headings.");
  }
  const categoryMap = new Map(categories.map((category) => [category.name.toLowerCase(), category.id]));
  return lines.slice(1).map((line) => {
    const values = parseCSVLine(line, delimiter);
    let amount = indexes.amount >= 0 ? parseAmount(values[indexes.amount]) : 0;
    if (indexes.amount < 0) {
      const debit = Math.abs(parseAmount(values[indexes.debit]));
      const credit = Math.abs(parseAmount(values[indexes.credit]));
      amount = credit ? credit : -debit;
    }
    const categoryName = indexes.category >= 0 ? String(values[indexes.category] || "").toLowerCase() : "";
    return {
      id: uid("txn"),
      date: parseDateValue(values[indexes.date]),
      name: values[indexes.description] || "Imported transaction",
      amount: Math.abs(amount),
      type: amount >= 0 ? "income" : "expense",
      categoryId: categoryMap.get(categoryName) || "uncategorised",
      note: "Imported from CSV",
      cleared: true,
      createdAt: new Date().toISOString(),
    };
  }).filter((transaction) => transaction.amount > 0);
}

export function validateState(candidate) {
  if (!candidate || typeof candidate !== "object") throw new Error("This backup is not valid.");
  for (const key of ["profile", "categories", "transactions", "bills", "goals"]) {
    if (!(key in candidate)) throw new Error(`The backup is missing ${key}.`);
  }
  if (![candidate.categories, candidate.transactions, candidate.bills, candidate.goals].every(Array.isArray)) {
    throw new Error("The backup contains invalid lists.");
  }
  return true;
}
