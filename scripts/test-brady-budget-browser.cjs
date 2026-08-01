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

async function login(page, email, password, entryPath = '/budget/login') {
  await page.goto(`${baseUrl}${entryPath}`, { waitUntil: 'networkidle' });
  if (entryPath === '/brady-budget/' && !page.url().includes('/budget/login')) {
    throw new Error(`The existing Home Screen launch path opened ${page.url()} instead of the Brady Budget login.`);
  }
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

async function addShoppingItem(page, name, recurring = false, storeId = 'aldi', manualCost = null) {
  await page.getByRole('button', { name: 'Add item', exact: true }).click();
  await page.locator('#shopping-item-store').selectOption(storeId);
  await page.locator('#shopping-name').fill(name);
  await page.locator('#shopping-quantity').fill('1');
  await page.waitForFunction(() => Number(document.querySelector('#shopping-cost')?.value) > 0);
  const predictedPrice = await page.locator('#shopping-cost').inputValue();
  if (manualCost != null) await page.locator('#shopping-cost').fill(String(manualCost));
  if (recurring) await page.getByLabel('Add every week').check();
  await page.locator('#modal-root').getByRole('button', { name: 'Add item', exact: true }).click();
  return predictedPrice;
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
    await login(pageA, emailA, passwordA, '/brady-budget/');
    await pageA.getByRole('button', { name: 'Explore sample' }).click();
    await pageA.getByText('Safe to spend', { exact: true }).waitFor();

    const manifest = await pageA.evaluate(async () => fetch('./manifest.webmanifest', { cache: 'no-store' }).then((response) => response.json()));
    if (manifest.start_url !== '/budget' || manifest.scope !== '/') throw new Error(`The Home Screen manifest is not using the stable launch route: ${JSON.stringify(manifest)}`);
    await pageA.goto(`${baseUrl}/budget`, { waitUntil: 'domcontentloaded' });
    await pageA.waitForURL('**/brady-budget/index.html**');
    await pageA.locator('body:not(.auth-pending)').waitFor({ timeout: 15_000 });
    const reopenedWelcome = pageA.getByRole('button', { name: 'Explore sample' });
    if (await reopenedWelcome.isVisible()) await reopenedWelcome.click();
    await pageA.getByText('Safe to spend', { exact: true }).waitFor();

    await pageA.getByRole('button', { name: 'How to use Brady Budget' }).click();
    const guideText = await pageA.locator('.how-to-guide').innerText();
    if (!guideText.includes('Plan where your money will go') || !guideText.includes('Make a shopping list')) throw new Error('The in-app guide is missing budget or shopping help.');
    if (/add partner|create profile|partner profile/i.test(guideText)) throw new Error('The in-app guide includes partner-profile setup instructions.');
    await pageA.getByRole('button', { name: 'Got it' }).click();

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
    const predictedMilkPrice = await addShoppingItem(pageA, 'Milk', true, 'aldi');
    if (predictedMilkPrice !== '3.55') throw new Error(`ALDI milk prediction was ${predictedMilkPrice}, not 3.55.`);
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

    await milkB.getByRole('button', { name: 'Edit Milk' }).click();
    await pageB.locator('#shopping-cost').fill('3.45');
    await pageB.locator('#modal-root').getByRole('button', { name: 'Save item' }).click();
    await pageA.locator('.shopping-row').filter({ hasText: 'ALDI saved price' }).waitFor({ timeout: 5_000 });
    await pageA.getByRole('button', { name: 'Add item', exact: true }).click();
    await pageA.locator('#shopping-item-store').selectOption('aldi');
    await pageA.locator('#shopping-name').fill('Milk');
    if (await pageA.locator('#shopping-cost').inputValue() !== '3.45') throw new Error('Corrected ALDI milk price was not learned across phones.');
    await pageA.getByRole('button', { name: 'Close' }).click();

    await milkB.locator('.shopping-check').click();
    await pageA.locator('.shopping-row.checked').filter({ hasText: 'Milk' }).waitFor({ timeout: 5_000 });

    await Promise.all([
      addShoppingItem(pageA, 'Bread', false, 'coles'),
      addShoppingItem(pageB, 'Eggs', false, 'woolworths'),
    ]);
    for (const page of [pageA, pageB]) {
      await page.getByText('Bread', { exact: true }).waitFor({ timeout: 8_000 });
      await page.getByText('Eggs', { exact: true }).waitFor({ timeout: 8_000 });
      await page.locator('.shopping-row').filter({ hasText: 'Bread' }).filter({ hasText: 'Coles estimate' }).waitFor();
      await page.locator('.shopping-row').filter({ hasText: 'Eggs' }).filter({ hasText: 'Woolworths estimate' }).waitFor();
      if ((await page.locator('.shopping-total').textContent()).trim() !== '$12.25') throw new Error('Mixed-store expected total is incorrect.');
    }

    const predictedOtherRice = await addShoppingItem(pageA, 'Rice', false, 'other');
    if (predictedOtherRice !== '3.20') throw new Error(`Other-store rice prediction was ${predictedOtherRice}, not 3.20.`);
    for (const page of [pageA, pageB]) {
      await page.locator('.shopping-row').filter({ hasText: 'Rice' }).filter({ hasText: 'Other estimate' }).waitFor({ timeout: 5_000 });
      if ((await page.locator('.shopping-total').textContent()).trim() !== '$15.45') throw new Error('Other-store item was not included in the shared total.');
    }

    await addShoppingItem(pageA, 'Dragon Fruit Box', false, 'other', 8.75);
    await pageB.locator('.shopping-row').filter({ hasText: 'Dragon Fruit Box' }).waitFor({ timeout: 5_000 });
    await pageB.getByRole('button', { name: 'Add item', exact: true }).click();
    await pageB.locator('#shopping-item-store').selectOption('other');
    await pageB.locator('#shopping-name').fill('drag');
    const learnedProduct = pageB.locator('#shopping-product-suggestions').getByRole('button').filter({ hasText: 'Dragon Fruit Box' });
    await learnedProduct.waitFor({ timeout: 5_000 });
    if (!(await learnedProduct.textContent()).includes('$8.75')) throw new Error('The learned product suggestion did not retain its assigned price.');
    await learnedProduct.click();
    if (await pageB.locator('#shopping-cost').inputValue() !== '8.75') throw new Error('Selecting the learned product did not restore its assigned price.');
    await pageB.getByRole('button', { name: 'Close' }).click();

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

    await pageB.evaluate(() => {
      window.scrollTo(0, Math.min(320, document.documentElement.scrollHeight - innerHeight));
      window.__bradyMoreRoot = document.querySelector('#main-content .page-enter');
      window.__bradyMoreScroll = window.scrollY;
    });
    await pageB.waitForTimeout(6_500);
    const moreViewStability = await pageB.evaluate(() => ({
      sameRoot: window.__bradyMoreRoot === document.querySelector('#main-content .page-enter'),
      beforeScroll: window.__bradyMoreScroll,
      afterScroll: window.scrollY,
    }));
    if (!moreViewStability.sameRoot || Math.abs(moreViewStability.afterScroll - moreViewStability.beforeScroll) > 1) {
      throw new Error(`More view refreshed or moved during the sync heartbeat: ${JSON.stringify(moreViewStability)}`);
    }

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
      mixedStoreItemsSynced: true,
      otherStoreItemSynced: true,
      learnedProductSynced: true,
      simpleHowToGuide: true,
      homeScreenLaunchFixed: true,
      predictedMilkPrice,
      correctedPriceLearnedAcrossPhones: true,
      concurrentItemsMerged: true,
      tickOffSynced: true,
      recurringItemVisible: true,
      sharedBillSplit: '60/40',
      moreViewStability,
      accessibleYellowForegrounds: yellowForegrounds,
    }, null, 2));
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
