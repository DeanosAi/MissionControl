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

export function spendByCategory(transactions = [], key) {
  return transactionsForMonth(transactions, key)
    .filter((transaction) => transaction.type === "expense" && !transaction.excluded)
    .reduce((totals, transaction) => {
      const categoryId = transaction.categoryId || "uncategorised";
      totals[categoryId] = (totals[categoryId] || 0) + Math.abs(Number(transaction.amount) || 0);
      return totals;
    }, {});
}

export function calculateBudget(state, key = state.currentMonth) {
  const categories = state.categories.filter((category) => !category.archived);
  const monthTransactions = transactionsForMonth(state.transactions, key).filter((transaction) => !transaction.excluded);
  const spending = spendByCategory(state.transactions, key);
  const expenseTotal = monthTransactions
    .filter((transaction) => transaction.type === "expense")
    .reduce((sum, transaction) => sum + Math.abs(Number(transaction.amount) || 0), 0);
  const incomeReceived = monthTransactions
    .filter((transaction) => transaction.type === "income")
    .reduce((sum, transaction) => sum + Math.abs(Number(transaction.amount) || 0), 0);
  const expectedIncome = Number(state.profile.monthlyIncome) || 0;
  const categoryBudget = categories.reduce((sum, category) => sum + Math.max(0, Number(category.budget) || 0), 0);
  const goalContributions = state.goals
    .filter((goal) => !goal.archived)
    .reduce((sum, goal) => sum + Math.max(0, Number(goal.monthlyContribution) || 0), 0);
  const fixedCategories = categories.filter((category) => category.group === "fixed");
  const fixedBudget = fixedCategories.reduce((sum, category) => sum + Math.max(0, Number(category.budget) || 0), 0);
  const fixedSpent = fixedCategories.reduce((sum, category) => sum + (spending[category.id] || 0), 0);
  const variableSpent = expenseTotal - fixedSpent;
  const fixedReserve = Math.max(fixedBudget, fixedSpent);
  const safeToSpend = expectedIncome - fixedReserve - goalContributions - variableSpent;
  const readyToAssign = expectedIncome - categoryBudget - goalContributions;
  const categoryRows = categories.map((category) => {
    const spent = spending[category.id] || 0;
    const budget = Math.max(0, Number(category.budget) || 0);
    return { ...category, spent, remaining: budget - spent, percent: budget ? (spent / budget) * 100 : spent ? 100 : 0 };
  });
  const today = new Date();
  const viewed = parseLocalDate(`${key}-01`);
  const isCurrentMonth = key === monthKey(today);
  const daysInMonth = new Date(viewed.getFullYear(), viewed.getMonth() + 1, 0).getDate();
  const daysLeft = isCurrentMonth ? Math.max(1, daysInMonth - today.getDate() + 1) : daysInMonth;

  return {
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
