/* eslint-disable @typescript-eslint/no-require-imports */
const { chromium } = require('playwright');

const baseUrl = process.env.BRADY_TEST_BASE_URL || 'http://127.0.0.1:3100';
const emailA = process.env.BRADY_TEST_EMAIL_A;
const emailB = process.env.BRADY_TEST_EMAIL_B;
const passwordA = process.env.BRADY_TEST_PASSWORD_A;
const passwordB = process.env.BRADY_TEST_PASSWORD_B;

if (![emailA, emailB, passwordA, passwordB].every(Boolean)) {
  throw new Error('Two Brady Budget test credentials are required.');
}

async function login(page, email, password) {
  await page.goto(`${baseUrl}/budget/login`, { waitUntil: 'networkidle' });
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Open Brady Budget' }).click();
  await page.waitForURL('**/brady-budget/index.html**');
  await page.locator('body:not(.auth-pending)').waitFor({ timeout: 15_000 });
}

async function switchProfile(page, name) {
  await page.getByRole('button', { name: 'Switch budget profile' }).click();
  const choice = page.locator('.profile-choice').filter({ hasText: name });
  if (await choice.getByRole('button', { name: 'Switch' }).count()) {
    await choice.getByRole('button', { name: 'Switch' }).click();
  } else {
    await page.getByRole('button', { name: 'Close' }).click();
  }
  await page.waitForFunction(
    (expectedName) => document.querySelector('#profile-name')?.textContent === expectedName,
    name,
  );
}

async function openShopping(page) {
  await page.locator('.mobile-nav').getByText('Shopping', { exact: true }).click();
  await page.getByText('Shared grocery plan', { exact: true }).waitFor();
}

async function addShoppingItem(page, name, recurring = false) {
  await page.getByRole('button', { name: 'Add item', exact: true }).click();
  await page.locator('#shopping-name').fill(name);
  await page.locator('#shopping-quantity').fill('1');
  await page.locator('#shopping-cost').fill('4');
  if (recurring) await page.getByLabel('Add every week').check();
  await page.locator('#modal-root').getByRole('button', { name: 'Add item', exact: true }).click();
}

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const errors = [];
  const contextOptions = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true };
  const phoneA = await browser.newContext(contextOptions);
  const phoneB = await browser.newContext(contextOptions);
  const pageA = await phoneA.newPage();
  const pageB = await phoneB.newPage();
  for (const page of [pageA, pageB]) {
    page.on('pageerror', (error) => {
      errors.push(error.message);
      console.error(`Browser page error: ${error.message}`);
    });
    page.on('console', (message) => {
      if (message.type() !== 'error') return;
      errors.push(message.text());
      console.error(`Browser console error: ${message.text()}`);
    });
  }

  try {
    await login(pageA, emailA, passwordA);
    await pageA.getByRole('button', { name: 'Explore sample' }).click();
    await pageA.getByText('Safe to spend', { exact: true }).waitFor();

    await pageA.getByRole('button', { name: 'Switch budget profile' }).click();
    await pageA.getByRole('button', { name: 'Add partner' }).click();
    await pageA.locator('#partner-name').fill('Alex');
    await pageA.locator('#partner-income').fill('3000');
    await pageA.locator('#partner-cadence').selectOption('monthly');
    await pageA.getByRole('button', { name: 'Create profile' }).click();
    await pageA.waitForFunction(
      () => document.querySelector('#profile-name')?.textContent === 'Alex',
    );

    await login(pageB, emailB, passwordB);
    await pageB.getByText('Safe to spend', { exact: true }).waitFor();
    await switchProfile(pageB, 'Alex');
    await switchProfile(pageA, 'Dean');
    await pageA.waitForTimeout(800);
    if ((await pageB.locator('#profile-name').textContent()) !== 'Alex') {
      throw new Error('Phone profile selection leaked to the other phone.');
    }

    await openShopping(pageA);
    await openShopping(pageB);
    await pageA.getByRole('button', { name: 'Set budget' }).click();
    await pageA.locator('#shopping-budget').fill('200');
    await pageA.getByRole('button', { name: 'Save budget' }).click();
    const liveUpdateStartedAt = Date.now();
    const saveResponsePromise = pageA.waitForResponse((response) => {
      if (!response.url().endsWith('/api/budget/state') || response.request().method() !== 'PUT') return false;
      try {
        return response.request().postDataJSON().state.household.shopping.items
          .some((item) => item.name === 'Milk');
      } catch {
        return false;
      }
    });
    await addShoppingItem(pageA, 'Milk', true);
    const saveResponse = await saveResponsePromise;
    console.log(`Shopping save returned HTTP ${saveResponse.status()}.`);
    const serverSnapshot = await pageB.evaluate(async () => {
      const response = await fetch('/api/budget/state', { cache: 'no-store' });
      const payload = await response.json();
      return {
        status: response.status,
        hasMilk: payload.state?.household?.shopping?.items?.some((item) => item.name === 'Milk'),
        revision: payload.revision,
      };
    });
    console.log(`Second phone sees server snapshot: ${JSON.stringify(serverSnapshot)}.`);
    if (!serverSnapshot.hasMilk) throw new Error('The shared list save did not reach the server.');
    const milkB = pageB.locator('.shopping-row').filter({ hasText: 'Milk' });
    await milkB.waitFor({ timeout: 5_000 });
    const liveUpdateLatencyMs = Date.now() - liveUpdateStartedAt;
    console.log(`First cross-phone update arrived in ${liveUpdateLatencyMs}ms.`);
    await pageB.getByText('Weekly', { exact: true }).waitFor();

    await milkB.locator('.shopping-check').click();
    await pageA.locator('.shopping-row.checked').filter({ hasText: 'Milk' }).waitFor({ timeout: 5_000 });

    await Promise.all([
      addShoppingItem(pageA, 'Bread'),
      addShoppingItem(pageB, 'Eggs'),
    ]);
    for (const page of [pageA, pageB]) {
      await page.getByText('Bread', { exact: true }).waitFor({ timeout: 8_000 });
      await page.getByText('Eggs', { exact: true }).waitFor({ timeout: 8_000 });
    }

    await pageA.locator('.mobile-nav').getByText('More', { exact: true }).click();
    await pageA.getByRole('button', { name: 'Add bill' }).click();
    await pageA.locator('#bill-name').fill('Internet');
    await pageA.locator('#bill-amount').fill('100');
    await pageA.locator('#bill-sharing').selectOption('shared');
    await pageA.locator('#bill-your-share').fill('60');
    await pageA.locator('#modal-root').getByRole('button', { name: 'Save bill' }).click();

    await pageB.locator('.mobile-nav').getByText('More', { exact: true }).click();
    const internetB = pageB.locator('.bill-row').filter({ hasText: 'Internet' });
    await internetB.waitFor({ timeout: 5_000 });
    if (!(await internetB.textContent()).includes('$40')) throw new Error('Partner did not receive the $40 shared bill split.');

    await openShopping(pageA);
    await pageA.evaluate(() => { document.documentElement.dataset.theme = 'dark'; });
    const yellowForegrounds = await pageA.evaluate(() => ({
      accent: getComputedStyle(document.querySelector('.button.accent')).color,
      logo: getComputedStyle(document.querySelector('.brand-mark strong')).color,
      floating: getComputedStyle(document.querySelector('.fab')).color,
    }));
    for (const [control, colour] of Object.entries(yellowForegrounds)) {
      if (colour !== 'rgb(16, 42, 42)') throw new Error(`${control} uses ${colour} on yellow.`);
    }

    await pageA.evaluate(() => { document.documentElement.dataset.theme = 'light'; });
    await pageA.waitForTimeout(3_500);
    await pageA.screenshot({ path: '.codex-preview/brady-budget-browser-verification.png', fullPage: true });
    if (errors.length) throw new Error(`Browser errors: ${errors.join(' | ')}`);
    console.log(JSON.stringify({
      profilesIndependent: true,
      realtimeShopping: true,
      concurrentItemsMerged: true,
      tickOffSynced: true,
      recurringItemVisible: true,
      sharedBillSplit: '60/40',
      accessibleYellowForegrounds: yellowForegrounds,
    }, null, 2));
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
