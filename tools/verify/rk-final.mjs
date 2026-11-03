import { chromium } from '/Users/careynohook/.npm/_npx/e41f203b7505f1fb/node_modules/playwright/index.mjs';

const BASE = 'http://localhost:4179/ruankao/';
const KEY = 'ruankao.state.v1';
const initial = {
  version: 1, progress: {}, wrong: {}, fav: [], exams: [],
  settings: { theme: 'light', fontScale: 0, immediateJudge: true, dailyGoal: 20 },
  log: [], resume: {}, checkins: [], daily: {},
};
const browser = await chromium.launch();
const out = [];
async function fresh(seed = {}, extra = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  await page.addInitScript(([k, v, ex]) => {
    localStorage.setItem(k, JSON.stringify(v));
    for (const [ek, ev] of Object.entries(ex)) localStorage.setItem(ek, JSON.stringify(ev));
  }, [KEY, { ...initial, ...seed }, extra]);
  return { ctx, page };
}
const read = (p) => p.evaluate((k) => JSON.parse(localStorage.getItem(k) || '{}'), KEY);
async function run(n, fn) { try { out.push(await fn()); } catch (e) { out.push({ test: n, ERROR: String(e).split('\n')[0] }); } }

/* T1 时间到自动交卷（startedAt 恰在时长边缘） */
await run('T1', async () => {
  const now = Date.now();
  const draft = {
    ids: ['db-001', 'db-002', 'db-003', 'db-004', 'db-005'],
    answers: {},
    startedAt: now - 150 * 60 * 1000 + 4000, // 4 秒后超时
    updatedAt: now,
    index: 0,
  };
  const { ctx, page } = await fresh({}, { 'ruankao.paper.draft.v1:am:mock': draft });
  await page.goto(BASE + '#/mock/am/mock');
  await page.waitForSelector('.q-stem', { timeout: 25000 });
  const before = await page.locator('.topbar__title').innerText();
  await page.waitForSelector('.result-score', { timeout: 20000 });
  await page.waitForTimeout(600);
  const banners = await page.locator('.banner').allInnerTexts();
  const r = {
    test: 'T1 考试时间到自动交卷',
    before,
    after: await page.locator('.topbar__title').innerText(),
    banners: banners.map((b) => b.replace(/\s+/g, ' ').slice(0, 46)),
  };
  await ctx.close(); return r;
});

/* T2 完整 9 项复检（精简） */
await run('T2', async () => {
  const { ctx, page } = await fresh({
    wrong: { 'dp-006': { firstAt: Date.now(), lastAt: Date.now(), cleared: false, dueAt: 0 } },
  });
  await page.goto(BASE + '#/play/wrong');
  await page.waitForSelector('.q-stem', { timeout: 20000 });
  await page.locator('.actionbar .btn--primary').click();
  await page.waitForTimeout(500);
  const b = page.locator('.self-row .self-btn');
  for (let i = 0; i < 3; i++) { await b.first().click({ force: true }); await page.waitForTimeout(150); }
  const s = await read(page);
  const r = { test: 'T2 自评连点', tries: s.progress['dp-006']?.tries, log: s.log.length, streak: s.progress['dp-006']?.streak };
  await ctx.close(); return r;
});

await run('T3', async () => {
  const { ctx, page } = await fresh();
  await page.goto(BASE + '#/mock/pm/mock');
  await page.waitForSelector('.q-stem', { timeout: 25000 });
  await page.waitForTimeout(600);
  await page.getByRole('button', { name: '交卷', exact: true }).click();
  await page.waitForSelector('.self-btn', { timeout: 20000 });
  await page.waitForTimeout(300);
  await page.locator('.self-btn').nth(0).click();
  await page.waitForTimeout(250);
  const before = await page.locator('.self-btn.is-ok, .self-btn.is-bad').count();
  await page.reload();
  await page.waitForSelector('.actionbar', { timeout: 25000 });
  await page.waitForTimeout(1400);
  const r = {
    test: 'T3 自评进度刷新',
    before,
    after: await page.locator('.self-btn.is-ok, .self-btn.is-bad').count(),
    topbar: await page.locator('.topbar__title').innerText(),
  };
  await ctx.close(); return r;
});

await run('T4', async () => {
  const now = Date.now();
  const draft = { ids: ['db-001'], answers: {}, startedAt: now - 3 * 3600 * 1000, updatedAt: now - 60000, index: 0 };
  const { ctx, page } = await fresh({}, { 'ruankao.paper.draft.v1:am:mock': draft });
  await page.goto(BASE + '#/mock/am/mock');
  await page.waitForTimeout(3000);
  const r = {
    test: 'T4 超时草稿丢弃',
    topbar: await page.locator('.topbar__title').innerText(),
    hasScore: await page.locator('.result-score').count(),
    notice: (await page.locator('.banner').first().innerText().catch(() => '')).replace(/\s+/g, ' ').slice(0, 40),
  };
  await ctx.close(); return r;
});

console.log(JSON.stringify(out, null, 2));
await browser.close();
