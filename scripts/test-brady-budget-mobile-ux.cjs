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
    const colourParts = (value) => (value.match(/[\d.]+/g) || []).map(Number);
    const hasYellowBackground = (element) => {
      const [red, green, blue, alpha = 1] = colourParts(getComputedStyle(element).backgroundColor);
      return alpha > 0.05 && red === 215 && green === 241 && blue === 92;
    };
    const effectiveBackground = (element) => {
      for (let current = element; current; current = current.parentElement) {
        const style = getComputedStyle(current);
        const [, , , alpha = 1] = colourParts(style.backgroundColor);
        if (alpha > 0.05 || style.backgroundImage !== 'none') return current;
      }
      return document.body;
    };
    const whiteOnYellow = [...document.querySelectorAll('*')].filter(visible).flatMap((element) => {
      const hasDirectText = [...element.childNodes].some((node) => node.nodeType === Node.TEXT_NODE && node.textContent.trim());
      const isIcon = element instanceof SVGElement;
      if (!hasDirectText && !isIcon) return [];
      const [red, green, blue] = colourParts(getComputedStyle(element).color);
      if (red < 245 || green < 245 || blue < 245 || !hasYellowBackground(effectiveBackground(element))) return [];
      return [{ element: element.tagName.toLowerCase(), text: element.textContent.trim().slice(0, 80), colour: getComputedStyle(element).color }];
    });
    const hero = document.querySelector('.hero-card');
    const heroAccentOverlaps = [];
    if (hero && visible(hero)) {
      const heroRect = hero.getBoundingClientRect();
      const accent = getComputedStyle(hero, '::after');
      const top = Number.parseFloat(accent.top);
      const right = Number.parseFloat(accent.right);
      const width = Number.parseFloat(accent.width);
      const height = Number.parseFloat(accent.height);
      const accentRect = {
        left: Math.max(heroRect.left, heroRect.right - right - width),
        right: Math.min(heroRect.right, heroRect.right - right),
        top: Math.max(heroRect.top, heroRect.top + top),
        bottom: Math.min(heroRect.bottom, heroRect.top + top + height),
      };
      for (const element of hero.querySelectorAll('.hero-label, .hero-value, .hero-subtitle, .hero-stats')) {
        const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
        const textRects = [];
        while (walker.nextNode()) {
          if (!walker.currentNode.textContent.trim()) continue;
          const range = document.createRange();
          range.selectNodeContents(walker.currentNode);
          textRects.push(...range.getClientRects());
        }
        const overlaps = textRects.some((textRect) => (
          accentRect.left < textRect.right && accentRect.right > textRect.left
          && accentRect.top < textRect.bottom && accentRect.bottom > textRect.top
        ));
        if (overlaps) heroAccentOverlaps.push(element.className);
      }
    }
    window.scrollTo(0, document.documentElement.scrollHeight);
    return new Promise((resolve) => requestAnimationFrame(() => {
      const fabRect = fab?.getBoundingClientRect();
      const lastRect = lastContent?.getBoundingClientRect();
      const navRect = nav?.getBoundingClientRect();
      resolve({
        viewportWidth: innerWidth,
        documentWidth: document.documentElement.scrollWidth,
        undersized,
        whiteOnYellow,
        heroAccentOverlaps,
        navFontSize: navLabel ? Number.parseFloat(getComputedStyle(navLabel).fontSize) : 0,
        contentClearsNav: !lastRect || !navRect || lastRect.bottom <= navRect.top,
        contentClearsFab: !lastRect || !fabRect || lastRect.bottom <= fabRect.top - 8,
      });
    }));
  });
  if (result.documentWidth > result.viewportWidth + 1) fail(`${label} has horizontal overflow`, result);
  if (result.undersized.length) fail(`${label} has touch targets smaller than 44px`, result.undersized);
  if (result.whiteOnYellow.length) fail(`${label} has white content on a yellow background`, result.whiteOnYellow);
  if (result.heroAccentOverlaps.length) fail(`${label} has hero text overlapping the yellow accent`, result.heroAccentOverlaps);
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

    await page.getByRole('button', { name: 'How to use Brady Budget' }).click();
    await page.getByRole('heading', { name: 'How to use Brady Budget' }).waitFor();
    const guideText = await page.locator('.how-to-guide').innerText();
    for (const heading of ['Plan where your money will go', 'Add money you get or spend', 'Make a shopping list', 'Use your saved price again']) {
      if (!guideText.includes(heading)) fail('How-to guide is missing a required section', heading);
    }
    if (/add partner|create profile|partner profile/i.test(guideText)) fail('How-to guide includes partner-profile setup instructions');
    await page.waitForTimeout(300);
    const guideAudit = await page.evaluate(() => {
      const modal = document.querySelector('.guide-modal');
      const rect = modal.getBoundingClientRect();
      const info = document.querySelector('#how-to-control').getBoundingClientRect();
      return { left: rect.left, right: rect.right, bottom: rect.bottom, viewportWidth: innerWidth, viewportHeight: innerHeight, infoWidth: info.width, infoHeight: info.height };
    });
    if (guideAudit.left < -1 || guideAudit.right > guideAudit.viewportWidth + 1 || guideAudit.bottom > guideAudit.viewportHeight + 1) fail('How-to guide escapes the iPhone viewport', guideAudit);
    if (guideAudit.infoWidth < 44 || guideAudit.infoHeight < 44) fail('How-to button is too small to tap', guideAudit);
    await page.screenshot({ path: path.join(previewDir, 'brady-budget-how-to-guide.png'), fullPage: false });
    await page.getByRole('button', { name: 'Got it' }).click();

    await page.getByRole('button', { name: /Choose budget period/ }).click();
    await page.getByLabel('Weekly').check();
    await page.locator('#period-anchor').fill('2026-07-15');
    if ((await page.locator('#period-preview-label').textContent()).trim() !== '13–19 July 2026') fail('Weekly date preview is incorrect');
    await page.screenshot({ path: path.join(previewDir, 'brady-budget-period-picker.png'), fullPage: false });
    await page.getByRole('button', { name: 'View budget', exact: true }).click();
    await page.locator('#period-anchor').waitFor({ state: 'detached' });
    await page.getByRole('heading', { name: 'Weekly snapshot' }).waitFor();

    await page.locator('.mobile-nav').getByText('Plan', { exact: true }).click();
    await page.waitForFunction(() => document.querySelector('#page-title')?.textContent === 'Weekly plan');
    if ((await page.locator('#page-title').textContent()).trim() !== 'Weekly plan') fail('Plan page did not use the weekly view');

    await page.getByRole('button', { name: 'Group', exact: true }).click();
    await page.locator('#group-name').fill('Pets & care');
    await page.locator('#group-note').fill('Food, vet and care');
    await page.getByRole('button', { name: 'Add group', exact: true }).click();
    await page.getByRole('heading', { name: 'Pets & care', exact: true }).waitFor();

    await page.getByRole('button', { name: 'Rename Pets & care', exact: true }).click();
    await page.locator('#group-name').fill('Animal costs');
    await page.getByRole('button', { name: 'Save group', exact: true }).click();
    await page.getByRole('heading', { name: 'Animal costs', exact: true }).waitFor();

    await page.getByRole('button', { name: 'Expenditure', exact: true }).click();
    await page.locator('#category-icon').fill('🐾');
    await page.locator('#category-name').fill('Pet food');
    await page.locator('#category-group').selectOption({ label: 'Animal costs' });
    await page.locator('#category-budget').fill('30');
    await page.locator('#category-frequency').selectOption('weekly');
    await page.getByRole('button', { name: 'Save expenditure', exact: true }).click();
    const petFood = page.getByRole('button', { name: /Pet food/ });
    await petFood.waitFor();
    if (!(await petFood.innerText()).includes('per week')) fail('Weekly expenditure frequency is not shown on the Plan row');

    await petFood.click();
    if (await page.locator('#category-budget').inputValue() !== '30') fail('Saved expenditure amount did not reopen correctly');
    if (await page.locator('#category-frequency').inputValue() !== 'weekly') fail('Saved weekly frequency did not reopen correctly');
    await page.locator('#category-frequency').selectOption('fortnightly');
    await page.getByRole('button', { name: 'Save expenditure', exact: true }).click();
    if (!(await petFood.innerText()).includes('per fortnight')) fail('Edited fortnightly frequency is not shown on the Plan row');

    await petFood.click();
    await page.getByRole('button', { name: 'Delete', exact: true }).click();
    await page.getByRole('heading', { name: 'Delete Pet food?' }).waitFor();
    await page.getByRole('button', { name: 'Delete', exact: true }).click();
    await petFood.waitFor({ state: 'detached' });

    const uncategorised = page.getByRole('button', { name: /Uncategorised/ });
    await uncategorised.click();
    await page.getByRole('button', { name: 'Delete', exact: true }).click();
    await page.getByRole('heading', { name: 'Delete Uncategorised?' }).waitFor();
    await page.getByRole('button', { name: 'Delete', exact: true }).click();
    await uncategorised.waitFor({ state: 'detached' });

    const assignedAudit = await page.evaluate(() => {
      const amount = (text) => Number(String(text).replace(/[^\d.-]/g, '')) || 0;
      const assignedCard = [...document.querySelectorAll('.metric-card')]
        .find((card) => card.querySelector('.metric-label')?.textContent.trim().startsWith('Assigned'));
      const assigned = amount(assignedCard?.querySelector('.metric-value')?.textContent);
      const groupTotals = [...document.querySelectorAll('.group-total')].map((element) => amount(element.textContent));
      return { assigned, groupTotal: groupTotals.reduce((sum, value) => sum + value, 0), groups: groupTotals.length, note: assignedCard?.querySelector('.metric-note')?.textContent.trim() };
    });
    if (Math.abs(assignedAudit.assigned - assignedAudit.groupTotal) > 2) fail('Assigned is not the running total of all expenditure groups', assignedAudit);
    if (!assignedAudit.note.includes('All planned expenses')) fail('Assigned total does not explain what it includes', assignedAudit);

    await page.reload({ waitUntil: 'networkidle' });
    await page.getByRole('heading', { name: 'Animal costs', exact: true }).waitFor();

    await page.locator('.mobile-nav').getByText('Overview', { exact: true }).click();
    await page.getByRole('button', { name: /Choose budget period/ }).click();
    const reopenedPeriod = {
      kind: await page.locator('input[name="periodKind"]:checked').inputValue(),
      anchor: await page.locator('#period-anchor').inputValue(),
    };
    if (reopenedPeriod.kind !== 'weekly' || reopenedPeriod.anchor !== '2026-07-15') fail('Calendar did not retain the selected weekly view', reopenedPeriod);

    await page.getByLabel('Fortnightly').check();
    if ((await page.locator('#period-preview-label').textContent()).trim() !== '13–26 July 2026') fail('Fortnightly date preview is incorrect');
    await page.getByRole('button', { name: 'View budget', exact: true }).click();
    await page.getByRole('heading', { name: 'Fortnightly snapshot' }).waitFor();
    for (const view of ['plan', 'activity', 'goals', 'shopping', 'more', 'overview']) {
      await page.locator('.mobile-nav').getByText(view[0].toUpperCase() + view.slice(1), { exact: true }).click();
      const periodControlName = await page.locator('#month-control').getAttribute('aria-label');
      if (!periodControlName.includes('Currently fortnightly')) fail(`${view} did not keep the app-wide fortnightly view`, periodControlName);
    }

    await page.getByRole('button', { name: /Choose budget period/ }).click();
    await page.getByLabel('Monthly').check();
    await page.getByRole('button', { name: 'View budget', exact: true }).click();
    await page.getByRole('heading', { name: 'Monthly snapshot' }).waitFor();

    await page.setViewportSize({ width: 320, height: 568 });
    await page.getByRole('button', { name: /Choose budget period/ }).click();
    await page.waitForTimeout(350);
    const periodPickerAudit = await page.evaluate(() => {
      const modal = document.querySelector('.modal');
      const rect = modal.getBoundingClientRect();
      const choices = [...document.querySelectorAll('.period-segmented span')].map((choice) => choice.getBoundingClientRect());
      return {
        left: rect.left,
        right: rect.right,
        bottom: rect.bottom,
        viewportWidth: innerWidth,
        viewportHeight: innerHeight,
        smallestChoiceHeight: Math.min(...choices.map((choice) => choice.height)),
      };
    });
    if (periodPickerAudit.left < -1 || periodPickerAudit.right > periodPickerAudit.viewportWidth + 1 || periodPickerAudit.bottom > periodPickerAudit.viewportHeight + 1) fail('Budget period picker escapes a small iPhone viewport', periodPickerAudit);
    if (periodPickerAudit.smallestChoiceHeight < 44) fail('Budget period choices are too small to tap', periodPickerAudit);
    await page.screenshot({ path: path.join(previewDir, 'brady-budget-period-picker-320px.png'), fullPage: false });
    await page.getByRole('button', { name: 'Close' }).click();
    await page.setViewportSize({ width: 390, height: 844 });

    await page.locator('.mobile-nav').getByText('Shopping', { exact: true }).click();
    await page.getByText('Shared grocery plan', { exact: true }).waitFor();

    await page.getByRole('button', { name: 'Add item', exact: true }).click();
    if (await page.locator('#shopping-item-store').inputValue() !== 'aldi') fail('New shopping items do not default to ALDI');
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
    await page.locator('.shopping-row').filter({ hasText: 'ALDI saved price' }).waitFor();

    await page.getByRole('button', { name: 'Add item', exact: true }).click();
    await page.locator('#shopping-item-store').selectOption('coles');
    await page.locator('#shopping-name').fill('Bread');
    if (await page.locator('#shopping-cost').inputValue() !== '2.90') fail('Coles bread estimate was not filled automatically');
    await page.locator('#modal-root').getByRole('button', { name: 'Add item', exact: true }).click();
    await page.locator('.shopping-row').filter({ hasText: 'Coles estimate' }).waitFor();
    await page.locator('.shopping-store-breakdown span').filter({ hasText: 'ALDI' }).waitFor();
    await page.locator('.shopping-store-breakdown span').filter({ hasText: 'Coles' }).waitFor();
    if ((await page.locator('.shopping-total').textContent()).trim() !== '$11.90') fail('Mixed-store running total is incorrect');

    await page.getByRole('button', { name: 'Add item', exact: true }).click();
    await page.locator('#shopping-item-store').selectOption('other');
    await page.locator('#shopping-name').fill('Rice');
    if (await page.locator('#shopping-cost').inputValue() !== '3.20') fail('Other-store rice estimate was not filled automatically');
    await page.locator('#modal-root').getByRole('button', { name: 'Add item', exact: true }).click();
    await page.locator('.shopping-row').filter({ hasText: 'Other estimate' }).waitFor();
    await page.locator('.shopping-store-breakdown span').filter({ hasText: 'Other' }).waitFor();
    if ((await page.locator('.shopping-total').textContent()).trim() !== '$15.10') fail('Other-store item was not included in the running total');

    await page.getByRole('button', { name: 'Add item', exact: true }).click();
    await page.locator('#shopping-item-store').selectOption('aldi');
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
    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator('.mobile-nav').getByText('Overview', { exact: true }).click();
    await page.waitForFunction(() => location.hash === '#overview');
    await page.waitForTimeout(500);
    const fieldTestOverview = await assertMobileLayout(page, 'field-test overview at 390px');
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: path.join(previewDir, 'brady-budget-field-test-overview-dark.png'), fullPage: false });
    if (pageErrors.length) fail('Mobile browser errors', pageErrors);

    console.log(JSON.stringify({ reopenedPeriod, periodPickerAudit, formAudit, layouts, quickAddByView, compactViewLayouts, activeNavigation, fieldTestOverview }, null, 2));
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
