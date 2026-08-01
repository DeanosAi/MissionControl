/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const baseUrl = process.env.BRADY_MOBILE_TEST_URL || 'http://127.0.0.1:4173';
const previewDir = path.resolve('.codex-preview');

function fail(message, detail) {
  throw new Error(`${message}${detail ? `: ${JSON.stringify(detail)}` : ''}`);
}

async function assertMobileLayout(page, label) {
  const result = await page.evaluate(() => {
    const visible = (element) => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
    };
    const targets = [
      ...document.querySelectorAll('button, a.button, .mobile-nav a'),
    ].filter(visible).map((element) => {
      const rect = element.getBoundingClientRect();
      return {
        name: element.getAttribute('aria-label') || element.textContent.trim(),
        width: Math.round(rect.width * 10) / 10,
        height: Math.round(rect.height * 10) / 10,
      };
    });
    const undersized = targets.filter((target) => target.width < 44 || target.height < 44);
    const navLabel = document.querySelector('.mobile-nav .nav-link span');
    const fab = document.querySelector('.fab:not([hidden])');
    const lastContent = document.querySelector('#main-content .page-enter > :last-child');
    const nav = document.querySelector('.mobile-nav');
    window.scrollTo(0, document.documentElement.scrollHeight);
    return new Promise((resolve) => requestAnimationFrame(() => {
      const fabRect = fab?.getBoundingClientRect();
      const lastRect = lastContent?.getBoundingClientRect();
      const navRect = nav?.getBoundingClientRect();
      resolve({
        viewportWidth: innerWidth,
        documentWidth: document.documentElement.scrollWidth,
        undersized,
        navFontSize: navLabel ? Number.parseFloat(getComputedStyle(navLabel).fontSize) : 0,
        contentClearsNav: !lastRect || !navRect || lastRect.bottom <= navRect.top,
        contentClearsFab: !lastRect || !fabRect || lastRect.bottom <= fabRect.top - 8,
      });
    }));
  });
  if (result.documentWidth > result.viewportWidth + 1) fail(`${label} has horizontal overflow`, result);
  if (result.undersized.length) fail(`${label} has touch targets smaller than 44px`, result.undersized);
  if (result.navFontSize < 10.5) fail(`${label} navigation labels are too small`, result.navFontSize);
  if (!result.contentClearsNav || !result.contentClearsFab) fail(`${label} fixed controls obscure final content`, result);
  return result;
}

(async () => {
  fs.mkdirSync(previewDir, { recursive: true });
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 1,
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));

  try {
    await page.goto(`${baseUrl}/index.html`, { waitUntil: 'networkidle' });
    await page.locator('body:not(.auth-pending)').waitFor({ timeout: 15_000 });
    await page.getByRole('button', { name: 'Explore sample' }).click();
    await page.getByText('Safe to spend', { exact: true }).waitFor();

    await page.getByRole('button', { name: 'Choose month' }).click();
    await page.locator('#mobile-month-picker').waitFor();
    await page.locator('#mobile-month-picker').fill('2026-07');
    await page.getByRole('button', { name: 'View month', exact: true }).click();
    await page.locator('#mobile-month-picker').waitFor({ state: 'detached' });
    await page.getByRole('button', { name: 'Choose month' }).click();
    const reopenedMonth = await page.locator('#mobile-month-picker').inputValue();
    if (reopenedMonth !== '2026-07') fail('Calendar button did not retain the selected month', reopenedMonth);
    await page.getByRole('button', { name: 'Close' }).click();

    await page.locator('.mobile-nav').getByText('Shopping', { exact: true }).click();
    await page.getByText('Shared grocery plan', { exact: true }).waitFor();
    if (await page.locator('#shopping-store').inputValue() !== 'aldi') fail('Shopping list does not default to ALDI');

    await page.getByRole('button', { name: 'Add item', exact: true }).click();
    await page.locator('#shopping-name').fill('mil');
    const predictedMilk = page.locator('#shopping-product-suggestions').getByRole('button', { name: /Milk 2L/ });
    await predictedMilk.waitFor();
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(previewDir, 'brady-budget-predictive-suggestions.png'), fullPage: false });
    await predictedMilk.click();
    if (await page.locator('#shopping-name').inputValue() !== 'Milk 2L') fail('Predictive product text did not complete Milk 2L');
    if (await page.locator('#shopping-cost').inputValue() !== '3.55') fail('ALDI milk estimate was not filled automatically');
    await page.locator('#shopping-quantity').fill('2');
    await page.locator('#shopping-cost').fill('4.50');
    await page.getByLabel('Add every week').check();

    const formAudit = await page.evaluate(() => {
      const modal = document.querySelector('.modal');
      const modalRect = modal.getBoundingClientRect();
      const controls = [...modal.querySelectorAll('input, select, textarea')];
      const actionButtons = [...modal.querySelectorAll('.modal-actions .button')].map((button) => button.getBoundingClientRect().height);
      return {
        modalLeft: modalRect.left,
        modalRight: modalRect.right,
        modalBottom: modalRect.bottom,
        viewportWidth: innerWidth,
        viewportHeight: innerHeight,
        smallestControlFont: Math.min(...controls.map((control) => Number.parseFloat(getComputedStyle(control).fontSize))),
        smallestAction: Math.min(...actionButtons),
        quantityInputMode: document.querySelector('#shopping-quantity').inputMode,
        costInputMode: document.querySelector('#shopping-cost').inputMode,
      };
    });
    if (formAudit.modalLeft < -1 || formAudit.modalRight > formAudit.viewportWidth + 1 || formAudit.modalBottom > formAudit.viewportHeight + 1) {
      fail('Mobile bottom sheet escapes the viewport', formAudit);
    }
    if (formAudit.smallestControlFont < 16) fail('Mobile form controls can trigger iOS zoom', formAudit);
    if (formAudit.smallestAction < 44) fail('Mobile modal action is too small', formAudit);
    if (formAudit.quantityInputMode !== 'numeric' || formAudit.costInputMode !== 'decimal') fail('Mobile numeric keyboards are not optimised', formAudit);
    await page.screenshot({ path: path.join(previewDir, 'brady-budget-mobile-form.png'), fullPage: false });

    await page.locator('#modal-root').getByRole('button', { name: 'Add item', exact: true }).click();
    const milkRow = page.locator('.shopping-row').filter({ hasText: 'Milk 2L' });
    await milkRow.waitFor();
    await page.locator('#shopping-store').selectOption('coles');
    await page.locator('.shopping-row').filter({ hasText: 'Coles estimate' }).waitFor();
    await page.locator('#shopping-store').selectOption('aldi');
    await page.locator('.shopping-row').filter({ hasText: 'ALDI saved price' }).waitFor();

    await page.getByRole('button', { name: 'Add item', exact: true }).click();
    await page.locator('#shopping-name').fill('Milk 2L');
    if (await page.locator('#shopping-cost').inputValue() !== '4.50') fail('Corrected ALDI price was not remembered');
    await page.getByRole('button', { name: 'Close' }).click();
    await page.waitForTimeout(3_500);

    const layouts = {};
    for (const viewport of [
      { width: 320, height: 568, label: 'small phone' },
      { width: 360, height: 800, label: 'standard phone' },
      { width: 390, height: 844, label: 'modern phone' },
      { width: 430, height: 932, label: 'large phone' },
    ]) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      layouts[viewport.label] = await assertMobileLayout(page, viewport.label);
      await page.evaluate(() => {
        window.scrollTo(0, 0);
        if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
      });
      await page.waitForTimeout(100);
      await page.screenshot({ path: path.join(previewDir, `brady-budget-${viewport.width}px.png`), fullPage: true });
    }

    const quickAddByView = {};
    const compactViewLayouts = {};
    await page.setViewportSize({ width: 320, height: 568 });
    for (const view of ['overview', 'plan', 'activity', 'goals', 'shopping', 'more']) {
      await page.locator('.mobile-nav').getByText(view[0].toUpperCase() + view.slice(1), { exact: true }).click();
      await page.waitForFunction((expectedView) => (
        location.hash === `#${expectedView}`
        && document.querySelector(`.mobile-nav [data-nav="${expectedView}"]`)?.getAttribute('aria-current') === 'page'
      ), view);
      quickAddByView[view] = await page.locator('#quick-add').isVisible();
      compactViewLayouts[view] = await assertMobileLayout(page, `${view} view at 320px`);
    }
    const expectedQuickAdd = { overview: true, plan: false, activity: true, goals: false, shopping: true, more: false };
    if (JSON.stringify(quickAddByView) !== JSON.stringify(expectedQuickAdd)) fail('Floating action is shown in the wrong mobile context', quickAddByView);

    const activeNavigation = await page.evaluate(() => {
      document.documentElement.dataset.theme = 'dark';
      const active = document.querySelector('.mobile-nav .nav-link.active');
      const style = getComputedStyle(active);
      return { label: active.textContent.trim(), color: style.color, background: style.backgroundColor };
    });
    if (activeNavigation.label !== 'More' || activeNavigation.background !== 'rgb(215, 241, 92)' || activeNavigation.color !== 'rgb(16, 42, 42)') {
      fail('Selected bottom navigation item is not legible in dark mode', activeNavigation);
    }
    await page.screenshot({ path: path.join(previewDir, 'brady-budget-active-tab-dark.png'), fullPage: false });
    if (pageErrors.length) fail('Mobile browser errors', pageErrors);

    console.log(JSON.stringify({ reopenedMonth, formAudit, layouts, quickAddByView, compactViewLayouts, activeNavigation }, null, 2));
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
