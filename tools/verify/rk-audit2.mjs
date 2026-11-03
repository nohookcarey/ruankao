import { chromium } from '/Users/careynohook/.npm/_npx/e41f203b7505f1fb/node_modules/playwright/index.mjs';

const BASE = 'http://localhost:4179/ruankao/';
const KEY = 'ruankao.state.v1';

const initial = {
  version: 1,
  progress: {},
  wrong: {},
  fav: [],
  exams: [],
  settings: { theme: 'light', fontScale: 0, immediateJudge: true, dailyGoal: 20 },
  log: [],
  resume: {},
  checkins: [],
  daily: {},
};

const browser = await chromium.launch();
const out = [];

async function fresh(seed = {}, extra = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  await page.addInitScript(
    ([k, v, ex]) => {
      localStorage.setItem(k, JSON.stringify(v));
      for (const [ek, ev] of Object.entries(ex)) localStorage.setItem(ek, JSON.stringify(ev));
    },
    [KEY, { ...initial, ...seed }, extra],
  );
  return { ctx, page };
}

function read(page) {
  return page.evaluate((k) => JSON.parse(localStorage.getItem(k) || '{}'), KEY);
}

async function run(name, fn) {
  try {
    out.push(await fn());
  } catch (e) {
    out.push({ test: name, ERROR: String(e).split('\n')[0] });
  }
}

/* 1. 案例题自评连点 */
await run('1', async () => {
  const { ctx, page } = await fresh({
    wrong: { 'dp-006': { firstAt: Date.now(), lastAt: Date.now(), cleared: false, dueAt: 0 } },
  });
  await page.goto(BASE + '#/play/wrong');
  await page.waitForSelector('.q-stem', { timeout: 20000 });
  const primary = page.locator('.actionbar .btn--primary');
  const btnText = await primary.innerText();
  await primary.click();
  await page.waitForTimeout(600);
  const selfBtns = page.locator('.self-row .self-btn');
  const cnt = await selfBtns.count();
  for (let i = 0; i < 3; i++) {
    if (await selfBtns.first().isVisible()) {
      await selfBtns.first().click();
      await page.waitForTimeout(200);
    }
  }
  const s = await read(page);
  const r = {
    test: '1. 案例题自评连点 3 次',
    primaryBtn: btnText,
    selfBtnCount: cnt,
    tries: s.progress['dp-006']?.tries ?? 0,
    logLen: s.log.length,
    streak: s.progress['dp-006']?.streak ?? 0,
  };
  await ctx.close();
  return r;
});

/* 2. Home 继续上次练习 */
await run('2', async () => {
  const { ctx, page } = await fresh({ resume: { 'chapter/db': 5, 'chapter/os': 12 } });
  await page.goto(BASE + '#/play/chapter/db');
  await page.waitForSelector('.q-stem', { timeout: 20000 });
  await page.waitForTimeout(800);
  const after = await read(page);
  await page.goto(BASE + '#/');
  await page.waitForSelector('.hero__actions', { timeout: 20000 });
  await page.waitForTimeout(600);
  const btn = page.locator('.hero__actions .hero__btn').first();
  const label = await btn.innerText();
  await btn.click();
  await page.waitForTimeout(1200);
  const r = {
    test: '2. 继续上次练习（最近练的是 db）',
    resumeObj: after.resume,
    btn: label,
    landed: page.url().split('#')[1],
  };
  await ctx.close();
  return r;
});

/* 3. 下午卷自评刷新 */
await run('3', async () => {
  const { ctx, page } = await fresh();
  await page.goto(BASE + '#/mock/pm/mock');
  await page.waitForSelector('.q-stem', { timeout: 25000 });
  await page.waitForTimeout(600);
  const submit = page.getByRole('button', { name: '交卷', exact: true });
  await submit.click();
  await page.waitForSelector('.self-btn', { timeout: 20000 });
  await page.waitForTimeout(400);
  const total = await page.locator('.self-btn').count();
  await page.locator('.self-btn').nth(0).click();
  await page.waitForTimeout(200);
  const markedBefore = await page.locator('.self-btn.is-ok, .self-btn.is-bad').count();
  await page.reload();
  await page.waitForSelector('.actionbar', { timeout: 25000 });
  await page.waitForTimeout(1200);
  const markedAfter = await page.locator('.self-btn.is-ok, .self-btn.is-bad').count();
  const title = await page.locator('.topbar__title').innerText();
  const r = {
    test: '3. 下午卷自评中途刷新',
    selfBtnTotal: total,
    markedBefore,
    markedAfter,
    afterReloadTopbar: title,
  };
  await ctx.close();
  return r;
});

/* 4. 超时草稿 */
await run('4', async () => {
  const now = Date.now();
  const draft = {
    ids: ['dp-006'],
    answers: {},
    startedAt: now - 3 * 3600 * 1000,
    updatedAt: now - 60 * 1000,
    index: 0,
  };
  const { ctx, page } = await fresh({}, { 'ruankao.paper.draft.v1:am:mock': draft });
  await page.goto(BASE + '#/mock/am/mock');
  await page.waitForTimeout(4000);
  const title = await page.locator('.topbar__title').innerText();
  const hasScore = await page.locator('.result-score').count();
  const s = await read(page);
  const r = {
    test: '4. 超时草稿（开始于 3 小时前，仍在 12h TTL 内）',
    topbar: title,
    hasScoreHero: hasScore,
    examRecords: (s.exams ?? []).length,
    draftStillThere: await page.evaluate(() =>
      Boolean(localStorage.getItem('ruankao.paper.draft.v1:am:mock')),
    ),
  };
  await ctx.close();
  return r;
});

/* 5. 非法 part */
await run('5', async () => {
  const { ctx, page } = await fresh();
  await page.goto(BASE + '#/mock/zz/mock');
  await page.waitForTimeout(3000);
  const title = await page.locator('.topbar__title').innerText();
  await ctx.close();
  return { test: '5. /mock/zz/mock 非法卷型', topbar: title };
});

/* 6. 随机组卷里是否混入案例题 */
await run('6', async () => {
  const { ctx, page } = await fresh();
  await page.goto(BASE + '#/exam');
  await page.waitForSelector('.q-stem', { timeout: 25000 });
  await page.waitForTimeout(600);
  const topbar = await page.locator('.topbar__title').innerText();
  const chip = await page.locator('.q-meta .chip').nth(1).innerText();
  const counter = await page.locator('.topbar .icon-btn').last().innerText();
  // 找一道案例题：点答题卡看是否有「案例」标记不方便，改为翻到有案例的位置
  const r = { test: '6. 随机组卷首题', topbar, typeChip: chip, answerCounter: counter };
  await ctx.close();
  return r;
});

console.log(JSON.stringify(out, null, 2));
await browser.close();
