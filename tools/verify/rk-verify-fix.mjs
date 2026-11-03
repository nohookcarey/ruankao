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

/* 1. 自评连点 */
await run('1', async () => {
  const { ctx, page } = await fresh({
    wrong: { 'dp-006': { firstAt: Date.now(), lastAt: Date.now(), cleared: false, dueAt: 0 } },
  });
  await page.goto(BASE + '#/play/wrong');
  await page.waitForSelector('.q-stem', { timeout: 20000 });
  await page.locator('.actionbar .btn--primary').click();
  await page.waitForTimeout(600);
  const btns = page.locator('.self-row .self-btn');
  for (let i = 0; i < 3; i++) { await btns.first().click({ force: true }); await page.waitForTimeout(200); }
  const s = await read(page);
  const r = {
    test: '1. 自评连点 3 次（修复后应 tries=1, log=1, streak=1）',
    tries: s.progress['dp-006']?.tries ?? 0,
    logLen: s.log.length,
    streak: s.progress['dp-006']?.streak ?? 0,
    disabled: await btns.first().isDisabled(),
  };
  await ctx.close(); return r;
});

/* 2. 继续上次练习 */
await run('2', async () => {
  const { ctx, page } = await fresh({ resume: { 'chapter/db': 5, 'chapter/os': 12 } });
  await page.goto(BASE + '#/play/chapter/db');
  await page.waitForSelector('.q-stem', { timeout: 20000 });
  await page.waitForTimeout(900);
  await page.goto(BASE + '#/study');
  await page.waitForSelector('.hero__actions', { timeout: 20000 });
  await page.waitForTimeout(600);
  const btn = page.locator('.hero__actions .hero__btn').first();
  await btn.click();
  await page.waitForTimeout(1300);
  const r = { test: '2. 最近练 db 后点继续（应落 /play/chapter/db）', landed: page.url().split('#')[1] };
  await ctx.close(); return r;
});

/* 3. 下午卷自评刷新 */
await run('3', async () => {
  const { ctx, page } = await fresh();
  await page.goto(BASE + '#/mock/pm/mock');
  await page.waitForSelector('.q-stem', { timeout: 25000 });
  await page.waitForTimeout(700);
  await page.getByRole('button', { name: '交卷', exact: true }).click();
  await page.waitForSelector('.self-btn', { timeout: 20000 });
  await page.waitForTimeout(400);
  await page.locator('.self-btn').nth(0).click();
  await page.waitForTimeout(300);
  const before = await page.locator('.self-btn.is-ok, .self-btn.is-bad').count();
  await page.reload();
  await page.waitForSelector('.actionbar', { timeout: 25000 });
  await page.waitForTimeout(1500);
  const after = await page.locator('.self-btn.is-ok, .self-btn.is-bad').count();
  const title = await page.locator('.topbar__title').innerText();
  const r = { test: '3. 下午卷自评刷新（应保持 mark 阶段且标记数不丢）', markedBefore: before, markedAfter: after, topbar: title };
  await ctx.close(); return r;
});

/* 4. 超时草稿 */
await run('4', async () => {
  const now = Date.now();
  const draft = { ids: ['dp-006'], answers: {}, startedAt: now - 3 * 3600 * 1000, updatedAt: now - 60000, index: 0 };
  const { ctx, page } = await fresh({}, { 'ruankao.paper.draft.v1:am:mock': draft });
  await page.goto(BASE + '#/mock/am/mock');
  await page.waitForTimeout(3500);
  const title = await page.locator('.topbar__title').innerText();
  const hero = await page.locator('.result-score').count();
  const notice = await page.locator('.banner').first().innerText().catch(() => '');
  const s = await read(page);
  const r = { test: '4. 超时草稿（应重新组卷，不生成成绩）', topbar: title, hasScore: hero, examRecords: (s.exams ?? []).length, notice: notice.slice(0, 40) };
  await ctx.close(); return r;
});

/* 5. 非法 part */
await run('5', async () => {
  const { ctx, page } = await fresh();
  await page.goto(BASE + '#/mock/zz/mock');
  await page.waitForTimeout(2500);
  const t = await page.locator('.topbar__title').innerText();
  const body = await page.locator('.empty__title').innerText().catch(() => '');
  await ctx.close(); return { test: '5. /mock/zz/mock', topbar: t, emptyTitle: body };
});

/* 6. 随机卷分母 */
await run('6', async () => {
  const { ctx, page } = await fresh();
  await page.goto(BASE + '#/exam');
  await page.waitForSelector('.q-stem', { timeout: 25000 });
  await page.waitForTimeout(500);
  const counter = await page.locator('.topbar .icon-btn').last().innerText();
  const title = await page.locator('.topbar__title').innerText();
  await ctx.close(); return { test: '6. 随机卷首屏', title, counter };
});

/* 7. 错题移除确认 */
await run('7', async () => {
  const { ctx, page } = await fresh({
    wrong: { 'dp-006': { firstAt: Date.now(), lastAt: Date.now(), cleared: false, dueAt: 0 } },
  });
  let asked = false, msg = '';
  page.on('dialog', async (d) => { asked = true; msg = d.message(); await d.dismiss(); });
  await page.goto(BASE + '#/wrong');
  await page.waitForSelector('.list-item', { timeout: 20000 });
  await page.waitForTimeout(500);
  await page.getByRole('button', { name: '移除', exact: true }).click();
  await page.waitForTimeout(700);
  const s = await read(page);
  const r = { test: '7. 错题移除（应有确认，取消后不删）', askedConfirm: asked, wrongLeft: Object.keys(s.wrong).length, msg: msg.slice(0, 30) };
  await ctx.close(); return r;
});

/* 8. 案例不自评跳过 */
await run('8', async () => {
  const { ctx, page } = await fresh({
    wrong: {
      'dp-006': { firstAt: Date.now(), lastAt: Date.now(), cleared: false, dueAt: 0 },
      'ds-008': { firstAt: Date.now(), lastAt: Date.now(), cleared: false, dueAt: 0 },
    },
  });
  await page.goto(BASE + '#/play/wrong');
  await page.waitForSelector('.q-stem', { timeout: 20000 });
  await page.waitForTimeout(400);
  const p = page.locator('.actionbar .btn--primary');
  await p.click(); await page.waitForTimeout(400);   // 看答案
  await p.click(); await page.waitForTimeout(400);   // 下一题（不自评）
  await p.click(); await page.waitForTimeout(400);   // 看答案
  await p.click(); await page.waitForTimeout(900);   // 完成
  const hero = await page.locator('.result-score').innerText().catch(() => '');
  const sub = await page.locator('.result-sub').first().innerText().catch(() => '');
  await ctx.close(); return { test: '8. 两道案例都不自评就跳过', hero, sub };
});

/* 9. 导入快照回滚入口 */
await run('9', async () => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  const prev = { ...initial, progress: { 'dp-006': { tries: 1, correct: 1, streak: 1, lastAt: Date.now() } } };
  await page.addInitScript(([k, v, pk, pv]) => {
    localStorage.setItem(k, JSON.stringify(v));
    localStorage.setItem(pk, JSON.stringify(pv));
  }, [KEY, initial, 'ruankao.state.prev', prev]);
  await page.goto(BASE + '#/settings');
  await page.waitForSelector('.setting-group', { timeout: 20000 });
  await page.waitForTimeout(600);
  const has = await page.getByText('恢复导入前的数据').count();
  await ctx.close(); return { test: '9. 有快照时显示恢复入口', visible: has > 0 };
});

console.log(JSON.stringify(out, null, 2));
await browser.close();
