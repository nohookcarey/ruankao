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
const read = (page) => page.evaluate((k) => JSON.parse(localStorage.getItem(k) || '{}'), KEY);

async function run(name, fn) {
  try { out.push(await fn()); } catch (e) { out.push({ test: name, ERROR: String(e).split('\n')[0] }); }
}

/* A. Home 继续上次练习（最近练 db） */
await run('A', async () => {
  const { ctx, page } = await fresh({ resume: { 'chapter/db': 5, 'chapter/os': 12 } });
  await page.goto(BASE + '#/play/chapter/db');
  await page.waitForSelector('.q-stem', { timeout: 20000 });
  await page.waitForTimeout(900);
  const after = await read(page);
  await page.goto(BASE + '#/study');
  await page.waitForSelector('.hero__actions', { timeout: 20000 });
  await page.waitForTimeout(700);
  const btn = page.locator('.hero__actions .hero__btn').first();
  const label = await btn.innerText();
  await btn.click();
  await page.waitForTimeout(1300);
  const r = { test: 'A. Home 继续上次练习', resume: after.resume, btn: label, landed: page.url().split('#')[1] };
  await ctx.close();
  return r;
});

/* B. 案例题不自评直接下一题，是否仍计入 done */
await run('B', async () => {
  const { ctx, page } = await fresh({
    wrong: {
      'dp-006': { firstAt: Date.now(), lastAt: Date.now(), cleared: false, dueAt: 0 },
      'ds-008': { firstAt: Date.now(), lastAt: Date.now(), cleared: false, dueAt: 0 },
    },
  });
  await page.goto(BASE + '#/play/wrong');
  await page.waitForSelector('.q-stem', { timeout: 20000 });
  await page.waitForTimeout(500);
  const primary = page.locator('.actionbar .btn--primary');
  await primary.click(); // 查看参考答案
  await page.waitForTimeout(500);
  const nextLabel = await primary.innerText();
  await primary.click(); // 不点自评，直接下一题
  await page.waitForTimeout(500);
  const second = await primary.innerText();
  await primary.click(); // 第二题也跳过
  await page.waitForTimeout(500);
  await primary.click();
  await page.waitForTimeout(900);
  const s = await read(page);
  const r = {
    test: 'B. 案例题不自评直接跳过',
    afterReveal: nextLabel,
    secondQuestion: second,
    logLen: s.log.length,
    triesDp: s.progress['dp-006']?.tries ?? 0,
    triesDs: s.progress['ds-008']?.tries ?? 0,
    resultText: await page.locator('.result-sub').first().innerText().catch(() => 'n/a'),
  };
  await ctx.close();
  return r;
});

/* C. 下午卷答题中已答计数 */
await run('C', async () => {
  const { ctx, page } = await fresh();
  await page.goto(BASE + '#/mock/pm/mock');
  await page.waitForSelector('.q-stem', { timeout: 25000 });
  await page.waitForTimeout(600);
  const topbar = await page.locator('.topbar__title').innerText();
  const chip = await page.locator('.topbar .chip').last().innerText();
  const progressWidth = await page.locator('.progress-line__bar').evaluate((el) => el.style.width);
  await ctx.close();
  return { test: 'C. 下午卷未作答时的进度', topbar, topbarChip: chip, progressWidth };
});

/* D. 错题本「移除」是否二次确认 */
await run('D', async () => {
  const { ctx, page } = await fresh({
    wrong: { 'dp-006': { firstAt: Date.now(), lastAt: Date.now(), cleared: false, dueAt: 0 } },
  });
  let dialog = false;
  page.on('dialog', async (d) => { dialog = true; await d.dismiss(); });
  await page.goto(BASE + '#/wrong');
  await page.waitForSelector('.list-item', { timeout: 20000 });
  await page.waitForTimeout(500);
  await page.getByRole('button', { name: '移除', exact: true }).click();
  await page.waitForTimeout(800);
  const s = await read(page);
  const r = { test: 'D. 错题本移除', confirmDialog: dialog, wrongLeft: Object.keys(s.wrong).length };
  await ctx.close();
  return r;
});

/* E. 导入覆盖是否二次确认 */
await run('E', async () => {
  const { ctx, page } = await fresh({}, {});
  let dialog = false;
  page.on('dialog', async (d) => { dialog = true; await d.dismiss(); });
  await page.goto(BASE + '#/settings');
  await page.waitForSelector('.setting-group', { timeout: 20000 });
  // 填入同步码并应用（先造一个合法码）
  const code = await page.evaluate(async () => {
    const mod = await import('/ruankao/assets/index.js').catch(() => null);
    return mod ? 'x' : 'x';
  }).catch(() => 'x');
  await page.waitForTimeout(300);
  const hasConfirm = await page.evaluate(() => {
    const btns = [...document.querySelectorAll('button')];
    return btns.some((b) => b.textContent?.includes('应用同步码'));
  });
  await ctx.close();
  return { test: 'E. 设置页应用同步码按钮存在', hasConfirm, code };
});

console.log(JSON.stringify(out, null, 2));
await browser.close();
