import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const errorsOf = (page: Page) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  return errors;
};

const goTo = async (page: Page, view: string) => {
  await page.locator(`.nav-btn[data-view="${view}"]`).click();
  await expect(page.locator('#main-heading')).toBeVisible();
};

test.beforeEach(async ({ page }) => {
  // The live Congress lookup is not needed for these tests.
  await page.route('https://unitedstates.github.io/**', (route) => route.abort());
});

test('dashboard loads and language switch is remembered', async ({ page }) => {
  const errors = errorsOf(page);
  await page.goto('./');
  await expect(page.locator('#main-heading')).toBeVisible();
  await page.locator('#lang-toggle-btn').click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'es');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('lang', 'es');
  expect(errors).toEqual([]);
});

test('every screen opens without errors and has no serious accessibility problems', async ({ page }) => {
  const errors = errorsOf(page);
  await page.goto('./');
  for (const view of ['dashboard', 'flashcards', 'exam', 'oral', 'english', 'bank']) {
    await goTo(page, view);
    await page.waitForTimeout(250); // view transition
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    const serious = results.violations
      .filter((v) => v.impact === 'serious' || v.impact === 'critical')
      .map((v) => `${view}: ${v.id} (${v.nodes.length}) ${v.nodes[0]?.target.join(' ')}`);
    expect(serious, serious.join('\n')).toEqual([]);
  }
  expect(errors).toEqual([]);
});

test('mock exam can be completed by self-grading and is saved', async ({ page }) => {
  await page.goto('./');
  await goTo(page, 'exam');
  await page.locator('#start-standard-btn').click();
  for (let i = 0; i < 30; i++) {
    const correct = page.locator('#exam-grade-correct');
    if (!(await page.locator('#exam-reveal-btn').isVisible().catch(() => false))) break;
    await page.locator('#exam-reveal-btn').click();
    await correct.click();
    await page.waitForTimeout(50);
    if (await page.locator('#exam-retake-btn').isVisible()) break;
  }
  await expect(page.locator('#exam-retake-btn')).toBeVisible();
  const history = await page.evaluate(
    () => JSON.parse(localStorage.getItem('civics128:state:v1') ?? '{}').examHistory,
  );
  expect(history).toHaveLength(1);
  expect(history[0].passed).toBe(true);
});

test('english writing gives friendly word-by-word feedback and saves progress', async ({ page }) => {
  await page.goto('./');
  await goTo(page, 'english');
  await page.locator('[data-tab="writing"]').click();
  await page.locator('#writing-input').fill('zzz');
  await page.locator('.typed-answer-form button[type=submit]').click();
  await expect(page.locator('.english-feedback.is-retry')).toBeVisible();
  await expect(page.locator('.word-mark.is-wrong').first()).toBeVisible();
  await page.locator('[data-action="retry-writing"]').click();
  await expect(page.locator('#writing-input')).toHaveValue('');
  const english = await page.evaluate(
    () => JSON.parse(localStorage.getItem('civics128:state:v1') ?? '{}').english,
  );
  expect(Object.keys(english.writing)).toHaveLength(1);
});

test('progress backup can be saved and restored', async ({ page }) => {
  await page.goto('./');
  await goTo(page, 'english');
  await page.locator('[data-tab="writing"]').click();
  await page.locator('#writing-input').fill('hello');
  await page.locator('.typed-answer-form button[type=submit]').click();
  await page.locator('#open-settings-btn').click();
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.locator('#export-backup-btn').click(),
  ]);
  const file = await download.path();
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.locator('#open-settings-btn').click();
  await page.locator('#import-backup-file').setInputFiles(file);
  await page.locator('#confirm-dialog .btn--primary, #confirm-dialog .btn--danger, #confirm-dialog .btn--soft-danger').last().click();
  await expect
    .poll(() =>
      page.evaluate(
        () => Object.keys(JSON.parse(localStorage.getItem('civics128:state:v1') ?? '{}').english?.writing ?? {}).length,
      ),
    )
    .toBe(1);
});

test('works offline after the first visit', async ({ page, context }) => {
  await page.goto('./');
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload(); // now controlled by the service worker
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator('#main-heading')).toBeVisible();
  await goTo(page, 'flashcards');
  await context.setOffline(false);
});

test('english mock interview runs from start to results', async ({ page }) => {
  // Without a microphone the app asks the learner to self-assess the reading.
  await page.addInitScript(() => {
    const w = window as unknown as Record<string, unknown>;
    delete w.SpeechRecognition;
    delete w.webkitSpeechRecognition;
  });
  await page.goto('./');
  await goTo(page, 'english');
  await page.locator('[data-tab="mock"]').click();
  await page.locator('[data-mock="start"]').click();
  for (let i = 0; i < 5; i++) await page.locator('[data-mock="n400-next"]').click();
  // Reading: speech recognition is not available in the test browser, so self-assess.
  await page.locator('[data-mock="self-read-ok"]').click();
  await page.locator('[data-mock="reading-next"]').click();
  // Writing: three wrong tries end the step.
  for (let i = 0; i < 3; i++) {
    await page.locator('#mock-writing-input').fill('wrong');
    await page.locator('[data-form="mock-writing"] button[type=submit]').click();
    await page.locator('[data-mock="writing-next"]').click();
  }
  await expect(page.locator('.mock-results .mock-result')).toHaveCount(3);
  await expect(page.locator('.mock-result.is-pass')).toHaveCount(2);
});

test('dashboard lists the questions missed in a mock exam', async ({ page }) => {
  await page.goto('./');
  await goTo(page, 'exam');
  await page.locator('#start-standard-btn').click();
  for (let i = 0; i < 30; i++) {
    if (!(await page.locator('#exam-reveal-btn').isVisible().catch(() => false))) break;
    await page.locator('#exam-reveal-btn').click();
    await page.locator('#exam-grade-wrong').click();
    await page.waitForTimeout(50);
    if (await page.locator('#exam-retake-btn').isVisible()) break;
  }
  await goTo(page, 'dashboard');
  await expect(page.locator('.missed-list li').first()).toBeVisible();
  await page.locator('#drill-missed-btn').click();
  await expect(page.locator('[data-filter="missed"]')).toBeVisible();
});
