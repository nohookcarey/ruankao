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

async function fresh(seed = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  await page.addInitScript(
    ([k, v]) => {
      localStorage.setItem(k, JSON.stringify(v));
    },
    [KEY, { ...initial, ...seed }],
  );
  return { ctx, page };
}

function read(page) {
  return page.evaluate((k) => JSON.parse(localStorage.getItem(k) || '{}'), KEY);
}

/* ---------- 1. 案例题自评连点 ---------- */
{
  const { ctx, page } = await fresh({
    wrong: { 'dp-006': { firstAt: Date.now(), lastAt: Date.now(), cleared: false, dueAt: 0 } },
  });
  await page.goto(BASE + '#/play/wrong');
  await page.waitForSelector('.q-stem', { timeout: 15000 });
  const btnText = await page.locator('.actionbar .btn--primary').innerText();
  await page.locator('.actionbar .btn--primary').click(); // 查看参考答案
  await page.waitForTimeout(400);
  const selfBtns = page.locator('.self-row .self-btn');
  const cnt = await selfBtns.count();
  if (cnt >= 1) {
    for (let i = 0; i < 3; i++) {
      await selfBtns.first().click();
      await page.waitForTimeout(150);
    }
  }
  const s = await read(page);
  out.push({
    test: '1. 案例题自评连点 3 次',
    primaryBtn: btnText,
    selfBtns: cnt,
    tries: s.progress['dp-006']?.tries ?? 0,
    logLen: s.log.length,
    streak: s.progress['dp-006']?.streak ?? 0,
  });
  await ctx.close();
}

/* ---------- 2. Home「继续上次练习」指向 ---------- */
{
  const { ctx, page } = await fresh({ resume: { 'chapter/db': 5, 'chapter/os': 12 } });
  // 先访问 db 章节，制造「最近练的是 db」
  await page.goto(BASE + '#/play/chapter/db');
  await page.waitForSelector('.q-stem', { timeout: 15000 });
  await page.waitForTimeout(600);
  const after = await read(page);
  await page.goto(BASE + '#/');
  await page.waitForSelector('.hero__actions', { timeout: 15000 });
  await page.waitForTimeout(500);
  const label = await page.locator('.hero__actions .hero__btn').first().innerText();
  await page.locator('.hero__actions .hero__btn').first().click();
  await page.waitForTimeout(900);
  const url = page.url();
  out.push({ test: '2. 继续上次练习', resumeObj: after.resume, btn: label, landed: url.replace(BASE, '') });
  await ctx.close();
}

/* ---------- 3. 下午卷自评进度刷新后是否保留 ---------- */
{
  const { ctx, page } = await fresh();
  await page.goto(BASE + '#/mock/pm/mock');
  await page.waitForSelector('.q-stem', { timeout: 20000 });
  await page.waitForTimeout(500);
  await page.locator('.actionbar .btn--primary').click(); // 交卷
  await page.waitForSelector('.self-btn', { timeout: 15000 });
  await page.waitForTimeout(300);
  const total = await page.locator('.self-btn').count();
  // 点前两个自评
  const ok = page.locator('.self-btn').nth(0);
  await ok.click();
  await page.waitForTimeout(150);
  const markedBefore = await page.locator('.self-btn.is-ok, .self-btn.is-bad').count();
  await page.reload();
  await page.waitForSelector('.actionbar', { timeout: 20000 });
  await page.waitForTimeout(800);
  const markedAfter = await page.locator('.self-btn.is-ok, .self-btn.is-bad').count();
  const phaseText = await page.locator('.topbar__title').innerText();
  out.push({
    test: '3. 下午卷自评刷新',
    selfBtnTotal: total,
    markedBefore,
    markedAfter,
    afterReloadPhase: phaseText,
  });
  await ctx.close();
}

/* ---------- 4. 已超时草稿进入后是否静默交卷 ---------- */
{
  const now = Date.now();
  const draft = {
    ids: ['dp-006'],
    answers: {},
    startedAt: now - 3 * 3600 * 1000,
    updatedAt: now - 60 * 1000,
    index: 0,
  };
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  await page.addInitScript(
    ([k, v, dk, dv]) => {
      localStorage.setItem(k, JSON.stringify(v));
      localStorage.setItem(dk, JSON.stringify(dv));
    },
    [KEY, initial, 'ruankao.paper.draft.v1:am:mock', draft],
  );
  await page.goto(BASE + '#/mock/am/mock');
  await page.waitForTimeout(3000);
  const title = await page.locator('.topbar__title').innerText();
  const heroNum = await page.locator('.result-score').count();
  const exams = (await read(page)).exams ?? [];
  out.push({
    test: '4. 超时草稿（开始于 3 小时前）',
    topbar: title,
    hasScoreHero: heroNum,
    examRecorded: exams.length,
  });
  await ctx.close();
}

/* ---------- 5. 非法 part 路由 ---------- */
{
  const { ctx, page } = await fresh();
  await page.goto(BASE + '#/mock/zz/mock');
  await page.waitForTimeout(2500);
  const title = await page.locator('.topbar__title').innerText();
  out.push({ test: '5. /mock/zz/mock', topbar: title });
  await ctx.close();
}

console.log(JSON.stringify(out, null, 2));
await browser.close();
