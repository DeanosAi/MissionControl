import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

class MemoryStorage {
  #values = new Map();
  getItem(key) { return this.#values.get(key) ?? null; }
  setItem(key, value) { this.#values.set(key, String(value)); }
  removeItem(key) { this.#values.delete(key); }
}

globalThis.sessionStorage = new MemoryStorage();
globalThis.localStorage = new MemoryStorage();

const { mergeBudgetStates } = await import('../public/brady-budget/js/storage.js');
const { calculateBudget, periodBounds, periodLabel, recurringAmountForPeriod } = await import('../public/brady-budget/js/calculations.js');
const { ensureHousehold, shoppingWeekKey } = await import('../public/brady-budget/js/profiles.js');
const { baseState } = await import('../public/brady-budget/js/seed.js');
const { estimateShoppingPrice, rememberShoppingPrice, suggestShoppingProducts } = await import('../public/brady-budget/js/pricing.js');

test('predicts store-specific grocery prices and learns household corrections', () => {
  const milk = estimateShoppingPrice('milk', 'aldi');
  const misspelledMilk = estimateShoppingPrice('millk', 'aldi');
  const colesMilk = estimateShoppingPrice('milk', 'coles');
  const otherRice = estimateShoppingPrice('rice', 'other');
  assert.deepEqual({ price: milk.price, product: milk.product, source: milk.source }, { price: 3.55, product: 'Milk 2L', source: 'guide' });
  assert.equal(misspelledMilk.product, 'Milk 2L');
  assert.equal(colesMilk.price, 3.55);
  assert.equal(otherRice.price, 3.20);
  assert.equal(estimateShoppingPrice('unlisted grocery item', 'aldi').price, 5);
  assert.equal(suggestShoppingProducts('mil', 'aldi')[0].name, 'Milk 2L');

  const memory = rememberShoppingPrice({}, 'aldi', 'Milk 2L', 3.45, '2026-08-01T00:00:00.000Z');
  const remembered = estimateShoppingPrice('milk 2l', 'aldi', memory);
  assert.equal(remembered.price, 3.45);
  assert.equal(remembered.source, 'memory');

  const otherMemory = rememberShoppingPrice({}, 'other', 'Market apples', 7, '2026-08-01T00:00:00.000Z');
  assert.equal(estimateShoppingPrice('Market apples', 'other', otherMemory).price, 7);

  const learnedProducts = rememberShoppingPrice(otherMemory, 'other', 'Dragon Fruit Box', 8.75, '2026-08-02T00:00:00.000Z');
  assert.deepEqual(suggestShoppingProducts('', 'other', learnedProducts)[0], { key: 'memory:dragon fruit box', name: 'Dragon Fruit Box', price: 8.75, source: 'memory' });
  assert.deepEqual(suggestShoppingProducts('drag', 'other', learnedProducts)[0], { key: 'memory:dragon fruit box', name: 'Dragon Fruit Box', price: 8.75, source: 'memory' });
  assert.equal(suggestShoppingProducts('drag', 'aldi', learnedProducts).length, 0);
  assert.equal(estimateShoppingPrice('Dragon Fruit Box', 'other', learnedProducts).product, 'Dragon Fruit Box');
});

test('merges simultaneous household shopping additions without losing either phone', () => {
  const base = { household: { shopping: { items: [] } } };
  const firstPhone = { household: { shopping: { items: [{ id: 'milk', name: 'Milk' }] } } };
  const secondPhone = { household: { shopping: { items: [{ id: 'bread', name: 'Bread' }] } } };
  const merged = mergeBudgetStates(base, firstPhone, secondPhone);
  assert.deepEqual(merged.household.shopping.items.map((item) => item.id).sort(), ['bread', 'milk']);
});

test('merges changes made to different individual profiles', () => {
  const base = { profiles: [{ id: 'dean', transactions: [] }, { id: 'partner', transactions: [] }] };
  const firstPhone = structuredClone(base);
  firstPhone.profiles[0].transactions.push({ id: 'dean-txn', amount: 20 });
  const secondPhone = structuredClone(base);
  secondPhone.profiles[1].transactions.push({ id: 'partner-txn', amount: 30 });
  const merged = mergeBudgetStates(base, firstPhone, secondPhone);
  assert.equal(merged.profiles[0].transactions[0].id, 'dean-txn');
  assert.equal(merged.profiles[1].transactions[0].id, 'partner-txn');
});

test('weekly shopping rollover restores recurring items and clears completed one-offs', () => {
  const state = baseState();
  state.household.shopping = {
    budget: 180,
    weekKey: '2000-01-03',
    items: [
      { id: 'milk', name: 'Milk', checked: true, recurring: true },
      { id: 'treat', name: 'Treat', checked: true, recurring: false },
      { id: 'rice', name: 'Rice', checked: false, recurring: false },
    ],
  };
  const rolled = ensureHousehold(state);
  assert.deepEqual(rolled.household.shopping.items.map((item) => item.id).sort(), ['milk', 'rice']);
  assert.equal(rolled.household.shopping.items.find((item) => item.id === 'milk').checked, false);
  assert.equal(rolled.household.shopping.weekKey, shoppingWeekKey());
  assert.equal(rolled.household.shopping.storeId, 'aldi');
});

test('shopping weeks start on Monday in local time', () => {
  assert.equal(shoppingWeekKey(new Date(2026, 7, 1)), '2026-07-27');
  assert.equal(shoppingWeekKey(new Date(2026, 7, 3)), '2026-08-03');
});

test('weekly, fortnightly, and monthly views use the correct dates and planning shares', () => {
  const weekly = periodBounds({ kind: 'weekly', anchor: '2026-08-05' });
  const fortnightly = periodBounds({ kind: 'fortnightly', anchor: '2026-08-05' });
  const monthly = periodBounds({ kind: 'monthly', anchor: '2026-08-05' });
  assert.deepEqual([weekly.start, weekly.end, weekly.days], ['2026-08-03', '2026-08-09', 7]);
  assert.deepEqual([fortnightly.start, fortnightly.end, fortnightly.days], ['2026-08-03', '2026-08-16', 14]);
  assert.deepEqual([monthly.start, monthly.end, monthly.days], ['2026-08-01', '2026-08-31', 31]);
  assert.equal(periodLabel({ kind: 'weekly', anchor: '2026-08-01' }), '27 July – 2 August 2026');

  const state = baseState();
  state.profile.monthlyIncome = 5200;
  state.categories = [
    { id: 'housing', name: 'Housing', group: 'fixed', budget: 520, archived: false },
    { id: 'groceries', name: 'Groceries', group: 'everyday', budget: 1040, archived: false },
  ];
  state.goals = [{ id: 'goal', monthlyContribution: 260, archived: false }];
  state.transactions = [
    { id: 'income', date: '2026-08-03', amount: 600, type: 'income' },
    { id: 'inside-week', date: '2026-08-04', amount: 100, type: 'expense', categoryId: 'groceries' },
    { id: 'second-week', date: '2026-08-10', amount: 999, type: 'expense', categoryId: 'groceries' },
  ];

  const weeklyBudget = calculateBudget(state, weekly);
  assert.equal(weeklyBudget.expectedIncome, 1200);
  assert.equal(weeklyBudget.categoryBudget, 360);
  assert.equal(weeklyBudget.goalContributions, 60);
  assert.equal(weeklyBudget.expenseTotal, 100);
  assert.equal(weeklyBudget.safeToSpend, 920);
  assert.equal(weeklyBudget.readyToAssign, 780);

  const fortnightlyBudget = calculateBudget(state, fortnightly);
  assert.equal(fortnightlyBudget.expectedIncome, 2400);
  assert.equal(fortnightlyBudget.categoryBudget, 720);
  assert.equal(fortnightlyBudget.goalContributions, 120);
  assert.equal(fortnightlyBudget.expenseTotal, 1099);
  assert.equal(Math.round(recurringAmountForPeriod(100, 'weekly', 'weekly')), 100);
  assert.equal(Math.round(recurringAmountForPeriod(100, 'weekly', 'fortnightly')), 200);
});

test('Brady Budget branding and yellow controls contain no white foreground artwork', async () => {
  const [styles, icon, index] = await Promise.all([
    readFile(new URL('../public/brady-budget/styles.css', import.meta.url), 'utf8'),
    readFile(new URL('../public/brady-budget/assets/icon.svg', import.meta.url), 'utf8'),
    readFile(new URL('../public/brady-budget/index.html', import.meta.url), 'utf8'),
  ]);
  assert.match(styles, /\.button\.accent\s*\{\s*color:\s*var\(--on-mint\)/);
  assert.match(styles, /\.brand-mark strong[\s\S]*?color:\s*var\(--on-mint\)/);
  assert.doesNotMatch(icon, /#fff|white/i);
  assert.match(index, /Brady Budget/);
  assert.doesNotMatch(index, /<strong>Harbour<\/strong>/);
});

test('mobile layout protects touch targets, navigation, forms, and bottom content', async () => {
  const [styles, app, index, storage, serviceWorker, manifestSource, nextConfig] = await Promise.all([
    readFile(new URL('../public/brady-budget/styles.css', import.meta.url), 'utf8'),
    readFile(new URL('../public/brady-budget/js/app.js', import.meta.url), 'utf8'),
    readFile(new URL('../public/brady-budget/index.html', import.meta.url), 'utf8'),
    readFile(new URL('../public/brady-budget/js/storage.js', import.meta.url), 'utf8'),
    readFile(new URL('../public/brady-budget/sw.js', import.meta.url), 'utf8'),
    readFile(new URL('../public/brady-budget/manifest.webmanifest', import.meta.url), 'utf8'),
    readFile(new URL('../next.config.ts', import.meta.url), 'utf8'),
  ]);
  assert.match(index, /viewport-fit=cover/);
  assert.match(styles, /--topbar:\s*calc\(72px \+ env\(safe-area-inset-top\)\)/);
  assert.match(styles, /#main-content\s*\{[^}]*padding:\s*20px 16px 112px/);
  assert.match(styles, /\.shopping-check\s*\{\s*width:\s*44px;\s*height:\s*44px/);
  assert.match(styles, /\.field input, \.field select, \.field textarea, \.search-box input\s*\{[^}]*font-size:\s*16px/);
  assert.match(styles, /max-height:\s*calc\(100dvh - env\(safe-area-inset-top\)\)/);
  assert.match(app, /quickAddViews = new Set\(\["overview", "activity", "shopping"\]\)/);
  assert.match(app, /input\.inputMode = input\.step === "1" \? "numeric" : "decimal"/);
  assert.match(app, /aria-pressed="\$\{item\.checked\}"/);
  assert.match(app, /function budgetPeriodModal\(\)/);
  assert.match(app, /data-form="period-picker"/);
  assert.match(app, /name="periodKind"/);
  assert.match(app, /Weekly/);
  assert.match(app, /Fortnightly/);
  assert.match(app, /Monthly/);
  assert.match(app, /id="shopping-item-store"/);
  assert.match(app, /shopping-store-breakdown/);
  assert.doesNotMatch(app, /id="shopping-store"/);
  assert.match(app, /function updateVisibleSyncStatus\(\)/);
  assert.doesNotMatch(app, /if \(activeView\(\) === "more"\) renderApp\(\);\s*\n\s*},\s*\n\s*}\);/);
  assert.match(styles, /\.mobile-nav \.nav-link\.active\s*\{\s*color:\s*var\(--on-mint\);\s*background:\s*var\(--mint\)/);
  assert.match(styles, /\.hero-card::after\s*\{[^}]*width:\s*80px;[^}]*height:\s*80px;/s);
  assert.doesNotMatch(styles, /\.hero-card::after\s*\{[^}]*width:\s*330px;/s);
  assert.match(app, /HOUSEHOLD_NOTICE_DISMISSED_KEY/);
  assert.match(app, /data-action="dismiss-household-notice"/);
  assert.match(app, /aria-label="Close individual budget message"/);
  assert.match(storage, /if \(remote\.status === status\) return;/);
  assert.match(serviceWorker, /brady-budget-v12/);

  const manifest = JSON.parse(manifestSource);
  assert.equal(manifest.id, '/budget');
  assert.equal(manifest.start_url, '/budget');
  assert.equal(manifest.scope, '/');
  assert.match(nextConfig, /skipTrailingSlashRedirect:\s*true/);
  assert.match(nextConfig, /source:\s*["']\/brady-budget\/["']/);
  assert.match(nextConfig, /destination:\s*["']\/brady-budget\/index\.html["']/);
  assert.match(serviceWorker, /isLegacyAppLaunch/);
  assert.match(serviceWorker, /caches\.match\(["']\.\/index\.html["']\)/);
  assert.match(serviceWorker, /!response\.redirected/);

  const guideStart = app.indexOf('function howToGuideModal');
  const guideEnd = app.indexOf('function budgetPeriodModal', guideStart);
  const guide = app.slice(guideStart, guideEnd);
  assert.match(guide, /How to use Brady Budget/);
  assert.match(guide, /Plan where your money will go/);
  assert.match(guide, /Make a shopping list/);
  assert.match(guide, /Weekly/);
  assert.match(guide, /Fortnightly/);
  assert.match(guide, /Monthly/);
  assert.match(guide, /Saved product/);
  assert.doesNotMatch(guide, /Add partner|Create profile|partner profile/i);
  assert.match(serviceWorker, /\.\/js\/pricing\.js/);
});

