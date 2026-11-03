import { chromium } from '/Users/careynohook/.npm/_npx/e41f203b7505f1fb/node_modules/playwright/index.mjs';

const BASE = 'https://nohookcarey.github.io/ruankao/';
const KEY = 'ruankao.state.v1';
const initial = {
  version: 1, progress: {}, wrong: {}, fav: [], exams: [],
  settings: { theme: 'light', fontScale: 0, immediateJudge: true, dailyGoal: 20 },
  log: [], resume: {}, checkins: [], daily: {},
};
const browser = await chromium.launch();
const out = [];
async function fresh(seed = {}, extra = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  const page = await ctx.newPage();
  await page.addInitScript(([k, v, ex]) => {
    localStorage.setItem(k, JSON.stringify(v));
    for (const [ek, ev] of Object.entries(ex)) localStorage.setItem(ek, JSON.stringify(ev));
  }, [KEY, { ...initial, ...seed }, extra]);
  return { ctx, page };
}
const read = (p) => p.evaluate((k) => JSON.parse(localStorage.getItem(k) || '{}'), KEY);
async function run(n, fn) { try { out.push(await fn()); } catch (e) { out.push({ test: n, ERROR: String(e).split('\n')[0] }); } }

await run('L1 首屏', async () => {
  const { ctx, page } = await fresh();
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.goto(BASE);
  await page.waitForSelector('.hero', { timeout: 25000 });
  await page.waitForTimeout(1800);
  const r = { test: 'L1 线上首屏', title: await page.locator('.h1').innerText(), errors: errs.slice(0, 3) };
  await ctx.close(); return r;
});

await run('L2 自评连点', async () => {
  const { ctx, page } = await fresh({
    wrong: { 'dp-006': { firstAt: Date.now(), lastAt: Date.now(), cleared: false, dueAt: 0 } },
  });
  await page.goto(BASE + '#/play/wrong');
  await page.waitForSelector('.q-stem', { timeout: 25000 });
  await page.locator('.actionbar .btn--primary').click();
  await page.waitForTimeout(600);
  const b = page.locator('.self-row .self-btn');
  for (let i = 0; i < 3; i++) { await b.first().click({ force: true }); await page.waitForTimeout(180); }
  const s = await read(page);
  const r = { test: 'L2 自评连点 3 次', tries: s.progress['dp-006']?.tries, log: s.log.length, disabled: await b.first().isDisabled() };
  await ctx.close(); return r;
});

await run('L3 继续上次练习', async () => {
  const { ctx, page } = await fresh({ resume: { 'chapter/db': 5, 'chapter/os': 12 } });
  await page.goto(BASE + '#/play/chapter/db');
  await page.waitForSelector('.q-stem', { timeout: 25000 });
  await page.waitForTimeout(900);
  await page.goto(BASE + '#/study');
  await page.waitForSelector('.hero__actions', { timeout: 25000 });
  await page.waitForTimeout(500);
  await page.locator('.hero__actions .hero__btn').first().click();
  await page.waitForTimeout(1400);
  const r = { test: 'L3 继续上次练习', landed: page.url().split('#')[1] };
  await ctx.close(); return r;
});

await run('L4 非法卷型', async () => {
  const { ctx, page } = await fresh();
  await page.goto(BASE + '#/mock/zz/mock');
  await page.waitForTimeout(2500);
  const r = { test: 'L4 非法卷型', topbar: await page.locator('.topbar__title').innerText() };
  await ctx.close(); return r;
});

await run('L5 下午卷自评刷新', async () => {
  const { ctx, page } = await fresh();
  await page.goto(BASE + '#/mock/pm/mock');
  await page.waitForSelector('.q-stem', { timeout: 25000 });
  await page.waitForTimeout(700);
  await page.getByRole('button', { name: '交卷', exact: true }).click();
  await page.waitForSelector('.self-btn', { timeout: 25000 });
  await page.waitForTimeout(400);
  await page.locator('.self-btn').nth(0).click();
  await page.waitForTimeout(300);
  const before = await page.locator('.self-btn.is-ok, .self-btn.is-bad').count();
  await page.reload();
  await page.waitForSelector('.actionbar', { timeout: 25000 });
  await page.waitForTimeout(1500);
  const r = {
    test: 'L5 下午卷自评刷新',
    before,
    after: await page.locator('.self-btn.is-ok, .self-btn.is-bad').count(),
    topbar: await page.locator('.topbar__title').innerText(),
  };
  await ctx.close(); return r;
});

console.log(JSON.stringify(out, null, 2));
await browser.close();
