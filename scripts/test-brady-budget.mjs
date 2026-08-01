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
  assert.match(app, /function monthPickerModal\(\)/);
  assert.match(app, /data-form="month-picker"/);
  assert.match(app, /id="shopping-item-store"/);
  assert.match(app, /shopping-store-breakdown/);
  assert.doesNotMatch(app, /id="shopping-store"/);
  assert.match(app, /function updateVisibleSyncStatus\(\)/);
  assert.doesNotMatch(app, /if \(activeView\(\) === "more"\) renderApp\(\);\s*\n\s*},\s*\n\s*}\);/);
  assert.match(styles, /\.mobile-nav \.nav-link\.active\s*\{\s*color:\s*var\(--on-mint\);\s*background:\s*var\(--mint\)/);
  assert.match(storage, /if \(remote\.status === status\) return;/);
  assert.match(serviceWorker, /brady-budget-v10/);

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
  const guideEnd = app.indexOf('function monthPickerModal', guideStart);
  const guide = app.slice(guideStart, guideEnd);
  assert.match(guide, /How to use Brady Budget/);
  assert.match(guide, /Plan where your money will go/);
  assert.match(guide, /Make a shopping list/);
  assert.match(guide, /Saved product/);
  assert.doesNotMatch(guide, /Add partner|Create profile|partner profile/i);
  assert.match(serviceWorker, /\.\/js\/pricing\.js/);
});

