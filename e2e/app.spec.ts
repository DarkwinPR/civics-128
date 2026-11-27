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

const IN_MORE = ['flashcards', 'oral', 'bank', 'audio'];

const goTo = async (page: Page, view: string) => {
  if (IN_MORE.includes(view)) {
    await page.locator('.nav-btn[data-view="more"]').click();
    await page.locator(`.more-card[data-go="${view}"]`).click();
  } else {
    await page.locator(`.nav-btn[data-view="${view}"]`).click();
  }
  await expect(page.locator('#main-heading')).toBeVisible();
};

/** Plays a path lesson to the end, learning each answer from the feedback. */
const playLesson = async (page: Page) => {
  const known: Record<string, string> = {};
  for (let i = 0; i < 120; i++) {
    if (await page.locator('.lesson-done').isVisible()) return;
    const q = ((await page.locator('.lesson-card .question-stem').textContent().catch(() => '')) ?? '').trim();
    if (await page.locator('#lesson-continue').isVisible()) {
      known[q] = ((await page.locator('.lesson-feedback .easiest-answer span[lang="en"]').textContent()) ?? '').trim();
      await page.locator('#lesson-continue').click();
    } else if (await page.locator('.choice-btn').first().isVisible()) {
      const opts = await page.locator('.choice-btn').allTextContents();
      const idx = known[q] ? Math.max(0, opts.findIndex((o) => o.includes(known[q]!))) : 0;
      await page.locator('.choice-btn').nth(idx).click();
    } else if (await page.locator('#path-input').isVisible()) {
      await page.locator('#path-input').fill(known[q] || 'no idea');
      await page.locator('#path-input').press('Enter');
    }
  }
  throw new Error('lesson did not finish');
};

test.beforeEach(async ({ page }, testInfo) => {
  // The live Congress lookup is not needed for these tests.
  await page.route('https://unitedstates.github.io/**', (route) => route.abort());
  // Skip the first-run welcome except in the test about it.
  if (!testInfo.title.includes('welcome')) {
    await page.addInitScript(() => localStorage.setItem('civics128:welcomeDone:v1', '1'));
  }
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
  for (const view of ['dashboard', 'path', 'exam', 'english', 'more', 'flashcards', 'oral', 'bank', 'audio']) {
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

test('learning path: finish a lesson, then the next one opens', async ({ page }) => {
  test.setTimeout(90_000);
  const errors = errorsOf(page);
  await page.goto('./');
  await page.locator('[data-go="path"]').first().click();
  await expect(page.locator('[data-path="lesson"][data-unit="0"][data-lesson="1"]')).toBeDisabled();
  await page.locator('[data-path="lesson"][data-unit="0"][data-lesson="0"]').click();
  await playLesson(page);
  await page.locator('[data-path="map"]').click();
  await expect(page.locator('[data-path="lesson"][data-unit="0"][data-lesson="1"]')).toBeEnabled();
  const progress = await page.evaluate(() => JSON.parse(localStorage.getItem('civics128:state:v1') ?? '{}').path);
  expect(Object.keys(progress.lessonsDone)).toHaveLength(1);
  // The lesson recorded memory answers for spaced repetition.
  const state = await page.evaluate(() => JSON.parse(localStorage.getItem('civics128:state:v1') ?? '{}'));
  expect(Object.keys(state.progress).length).toBeGreaterThan(0);
  expect(errors).toEqual([]);
});

test('learning path: a section exam can be taken to skip ahead', async ({ page }) => {
  await page.goto('./');
  await goTo(page, 'path');
  await page.locator('.path-skip').first().click();
  // Answer everything with "I don't remember": the exam is not passed.
  for (let i = 0; i < 12; i++) {
    if (await page.locator('.lesson-done').isVisible()) break;
    await page.locator('[data-path="dont-know"]').click();
    await page.locator('#lesson-continue').click();
  }
  await expect(page.locator('.lesson-done')).toBeVisible();
  await expect(page.locator('.missed-review li').first()).toBeVisible();
  await page.locator('[data-path="map"]').click();
  await expect(page.locator('[data-path="lesson"][data-unit="1"][data-lesson="0"]')).toBeDisabled();
});

test('learning path: interview date gives a daily plan', async ({ page }) => {
  await page.goto('./');
  await page.locator('#open-settings-btn').click();
  const date = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);
  await page.locator('#interview-date').fill(date);
  await page.locator('#interview-date').dispatchEvent('change');
  await page.locator('[data-close-dialog]').click();
  await goTo(page, 'path');
  await expect(page.locator('.path-plan--ok, .path-plan--tight')).toBeVisible();
});

test('listen mode shows the current section', async ({ page }) => {
  await page.goto('./');
  await goTo(page, 'audio');
  await expect(page.locator('.audio-card .question-stem')).toBeVisible();
  await expect(page.locator('[data-audio="play"]')).toBeVisible();
});

test('first visit welcome: test version, state and date, then the path', async ({ page }) => {
  const errors = errorsOf(page);
  await page.goto('./');
  const dialog = page.locator('dialog.welcome-dialog');
  await expect(dialog).toBeVisible();
  await page.locator('input[name="w-version"][value="2008"]').check();
  await page.locator('[data-w="next"]').click();
  await page.locator('#w-state').selectOption('TX');
  await page.locator('[data-w="next"]').click();
  const date = new Date(Date.now() + 40 * 86_400_000).toISOString().slice(0, 10);
  await page.locator('#w-date').fill(date);
  await page.locator('#w-date').dispatchEvent('change');
  await page.locator('[data-w="next"]').click();
  await expect(page.locator('[data-reminder="google"]')).toBeVisible();
  await page.locator('[data-w="start"]').click();
  await expect(dialog).toHaveCount(0);
  await expect(page.locator('.path-unit').first()).toBeVisible();
  const settings = await page.evaluate(() => JSON.parse(localStorage.getItem('civics128:state:v1') ?? '{}').settings);
  expect(settings).toMatchObject({ testVersion: '2008', homeState: 'TX', interviewDate: date });
  expect(settings.officials.stateCapital).toBe('Austin');
  // It does not come back on the next visit.
  await page.reload();
  await expect(page.locator('dialog.welcome-dialog')).toHaveCount(0);
  expect(errors.filter((e) => !e.includes('Failed to load resource'))).toEqual([]);
});

test('welcome can be skipped', async ({ page }) => {
  await page.goto('./');
  await page.locator('[data-w="skip"]').click();
  await expect(page.locator('dialog.welcome-dialog')).toHaveCount(0);
  await expect(page.locator('.home-cta')).toBeVisible();
});

test('full interview: N-400, civics with official rules, reading, writing, results', async ({ page }) => {
  test.setTimeout(90_000);
  await page.addInitScript(() => {
    const w = window as unknown as Record<string, unknown>;
    delete w.SpeechRecognition;
    delete w.webkitSpeechRecognition;
  });
  await page.goto('./');
  await goTo(page, 'exam');
  await page.locator('#start-full-interview-btn').click();
  await expect(page.locator('#main-heading')).toBeVisible();
  await page.locator('[data-mock="start"]').click();
  for (let i = 0; i < 5; i++) await page.locator('[data-mock="n400-next"]').click();
  // Civics: missing every answer ends the civics part at the fail threshold.
  for (let i = 0; i < 25; i++) {
    if (!(await page.locator('[data-mock="civics-dont-know"]').isVisible())) break;
    await page.locator('[data-mock="civics-dont-know"]').click();
    await expect(page.locator('.easiest-answer')).toBeVisible();
    await page.locator('[data-mock="civics-next"]').click();
  }
  await page.locator('[data-mock="self-read-ok"]').click();
  await page.locator('[data-mock="reading-next"]').click();
  for (let i = 0; i < 3; i++) {
    await page.locator('#mock-writing-input').fill('wrong');
    await page.locator('[data-form="mock-writing"] button[type=submit]').click();
    await page.locator('[data-mock="writing-next"]').click();
  }
  await expect(page.locator('.mock-results .mock-result')).toHaveCount(4);
  await expect(page.locator('.mock-result.is-retry')).toHaveCount(2); // civics and writing
  const progress = await page.evaluate(() => JSON.parse(localStorage.getItem('civics128:state:v1') ?? '{}').progress);
  expect(Object.keys(progress).length).toBeGreaterThanOrEqual(9);
});

test('path feedback shows the Spanish "why" explanation', async ({ page }) => {
  await page.goto('./');
  await goTo(page, 'path');
  await page.locator('[data-path="lesson"][data-unit="0"][data-lesson="0"]').click();
  await page.locator('.choice-btn').first().click();
  await expect(page.locator('.lesson-feedback .why-box')).toBeVisible();
});
