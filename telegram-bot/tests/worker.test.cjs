const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(`${__dirname}/../worker.js`, 'utf8').replace('export default {', 'const worker = {').replace(/^export \{[^}]+\};$/gm, '');
const context = vm.createContext({ console, Map, Set, Date: class extends Date {
  constructor(...args) { super(...(args.length ? args : ['2026-10-28T21:30:00Z'])); }
  static now() { return Date.parse('2026-10-28T21:30:00Z'); }
}});
vm.runInContext(source, context);
const parse = (meal, text, previous) => context.normalizeParsedMeal({ meal, date: '2026-10-29' }, text, previous);

test('multiple foods stay in food group when no beverage was consumed', () => {
  const result = parse({ foods: ['kuru fasulye'], drinks: ['krokan pasta'] }, 'dün kuru fasulye ve krokan pasta yedim bir şey içmedim');
  assert.equal(result.meal.foods.join(' + '), 'Kuru Fasulye + Krokan Pasta');
  assert.equal(result.meal.drinks.length, 0);
  assert.equal(result.meal.items.length, 1);
  assert.equal(result.date, '2026-10-28');
  assert.equal(result.day, 'Çarşamba');
});

test('follow-up preserves yesterday and no-drink information', () => {
  const first = parse({ foods: ['fasulye', 'pasta'], drinks: [] }, 'dün yedim içmedim');
  const next = parse({ foods: ['fasulye', 'pasta'], drinks: [] }, 'yurtta 100 tl', first);
  assert.equal(next.date, first.date);
  assert.equal(next.meal.items.length, 1);
});

test('real drinks and multiple foods remain separate', () => {
  const result = parse({ foods: ['fasulye', 'pasta'], drinks: ['ayran'] }, 'bugün fasulye pasta ve ayran');
  assert.equal(result.meal.items[0], 'Fasulye + Pasta');
  assert.equal(result.meal.items[1], 'Ayran');
  assert.equal(result.date, '2026-10-29');
});

test('explicit relative date overrides prior date', () => {
  const result = parse({ foods: ['pasta'], drinks: [] }, 'önceki gün', { date: '2026-10-29' });
  assert.equal(result.date, '2026-10-27');
});

test('quoted edit-list number selects a meal with or without an in-memory session', async () => {
  const calls = [];
  context.TextDecoder = TextDecoder;
  context.atob = atob;
  context.fetch = async (url, options) => {
    if (url.startsWith('https://api.github.com/')) {
      return { ok: true, json: async () => ({ sha: 'test', content: Buffer.from(JSON.stringify([
        { date: '2026-10-28', day: 'Çarşamba', meals: [
          { id: 'meal1', title: 'Pilav', items: ['Pilav'], location: 'Yurt', price: '50 TL' }
        ] }
      ])).toString('base64') }) };
    }
    assert.match(url, /api.telegram.org/); // No AI parsing or GitHub writes.
    calls.push(JSON.parse(options.body));
    return { ok: true, json: async () => ({ result: { message_id: 1 } }) };
  };
  for (const withSession of [true, false]) {
    calls.length = 0;
    vm.runInContext(`userSessions.clear(); ${withSession ? 'userSessions.set(123, { action: "duzenle_select_num" });' : ''}`, context);
    await context.handleIncomingUpdate({ message: {
      chat: { id: 123 }, from: { username: 'emirarkali' }, text: '1',
      reply_to_message: { text: '✏️ [DÜZENLEME MODU]\nHangi numaralı öğünü düzenlemek istiyorsun?\n💡 Vazgeçmek için: /iptal' }
    } }, { GITHUB_TOKEN: 'test', TELEGRAM_BOT_TOKEN: 'test' });
    assert.equal(calls.length, 1);
    assert.match(calls[0].text, /#1 Numaralı Öğün Seçildi/);
    assert.match(calls[0].text, /Yemek: Pilav/);
    assert.equal(vm.runInContext('userSessions.get(123).action', context), 'duzenle_submit');
  }
});

test('calorie ranges reject malformed or impossible values', () => {
  for (const value of [null, {}, { min: '100', max: 200 }, { min: -1, max: 5 }, { min: 500, max: 100 }, { min: 1, max: Infinity }]) {
    assert.equal(context.normalizeCalories(value), null);
  }
  assert.equal(context.normalizeCalories({ min: 100.2, max: 200.8 }).max, 201);
});

test('manual save persists calorie estimate and still saves when estimation fails', async () => {
  context.AbortSignal = AbortSignal;
  context.TextEncoder = TextEncoder;
  context.btoa = btoa;
  for (const available of [true, false]) {
    let written;
    context.fetch = async (url, options) => {
      if (url.includes('generativelanguage')) {
        if (!available) throw new Error('offline');
        return { ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify({ min: 450, max: 650, portions: '1 tabak pilav' }) }] } }] }) };
      }
      if (options.method === 'PUT') {
        written = JSON.parse(Buffer.from(JSON.parse(options.body).content, 'base64').toString());
        return { ok: true, json: async () => ({}) };
      }
      return { status: 404 };
    };
    const saved = await context.saveNewMealToGitHub('token', { title: 'Pilav', foods: ['Pilav'], drinks: [] }, '2026-10-28', 'Çarşamba', { id: 'emir', filePath: 'test.json' }, 'key');
    assert.equal(written[0].meals[0].title, 'Pilav');
    if (available) {
      assert.equal(saved.calories.min, 450);
      assert.equal(written[0].meals[0].calories.max, 650);
    } else assert.equal(written[0].meals[0].calories, null);
  }
});

test('punctuated no-drink replies are recognized without swallowing real drinks', () => {
  for (const text of ['İçmedim.', 'içmedim!', 'İÇMEDİM…', 'Yok.', 'Bir şey içmedim.', '  içmedim ? ']) {
    assert.equal(context.isNoDrink(text), true, text);
  }
  for (const text of ['Ayran.', 'Kola!', 'İçmedim gazozu']) assert.equal(context.isNoDrink(text), false, text);
});

test('no-drink placeholders are removed even when the model puts them in foods', () => {
  const result = parse({ foods: ['dolma', 'İçmedim.'], drinks: ['İçmedim!'] }, 'Dolma yedim bir şey içmedim.');
  assert.equal(result.meal.title, 'Dolma');
  assert.equal(result.meal.items.join(' + '), 'Dolma');
  assert.equal(result.meal.foods.length, 1);
  assert.equal(result.meal.drinks.length, 0);
});

test('scheduled Worker evaluates all profiles and writes only the shared review file', async () => {
  const fixtures = {
    'data/meals/can.json': [{ date: '2026-10-28', meals: [{ id: 'c1', title: 'Hamburger' }] }],
    'data/meals/emir.json': [{ date: '2026-10-28', meals: [{ id: 'e1', title: 'Fasulye' }] }],
    'data/meals/kemal.json': []
  };
  for (const available of [true, false]) {
    const writes = [];
    context.fetch = async (url, options) => {
      if (url.includes('generativelanguage')) {
        if (!available) return { ok: false, status: 503 };
        return { ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify({ ranking: [
          { id: 'can', reason: 'Kayıt sınırlı; hamburger var.', mealIds: ['c1'] },
          { id: 'emir', reason: 'Kayıt sınırlı; baklagil var.', mealIds: ['e1'] }
        ] }) }] } }] }) };
      }
      const path = new URL(url).pathname.split('/contents/')[1];
      if (options.method === 'PUT') {
        assert.equal(path, 'data/weekly-review.json');
        writes.push(JSON.parse(Buffer.from(JSON.parse(options.body).content, 'base64').toString()));
        return { ok: true, json: async () => ({}) };
      }
      if (!fixtures[path]) return { status: 404 };
      return { ok: true, json: async () => ({ sha: 'test', content: Buffer.from(JSON.stringify(fixtures[path])).toString('base64') }) };
    };
    const task = context.runDailyNutritionReview({ GEMINI_API_KEY: 'test', GITHUB_TOKEN: 'test' }, new Date('2026-10-28T09:00:00Z'));
    if (available) {
      await task;
      assert.equal(writes.length, 1);
      assert.equal(writes[0].window.end, '2026-10-28');
      assert.equal(writes[0].ranking.length, 2);
      assert.equal(writes[0].unranked[0].id, 'kemal');
    } else {
      await assert.rejects(task, /HTTP 503/);
      assert.equal(writes.length, 0);
    }
  }
});

test('AI failures explain quota errors and redact credentials from provider messages', async () => {
  const key = 'secret-for-test';
  context.fetch = async () => ({ ok: false, status: 429, json: async () => ({ error: {
    status: 'RESOURCE_EXHAUSTED', message: `Quota exceeded; limit: 20. key=${key} https://example.com?key=${key}`
  } }) });
  await assert.rejects(context.parseMealWithGeminiFast('Pilav yedim', key), error => {
    const message = context.aiUserError(error);
    assert.match(message, /429/);
    assert.match(message, /kotası/);
    assert.match(message, /limit: 20/);
    assert.equal(message.includes(key), false);
    assert.equal(message.includes('https://'), false);
    return true;
  });
});

test('calorie failure is reported without preventing the meal from being saved', async () => {
  const meal = { title: 'Pilav' };
  context.fetch = async () => ({ ok: false, status: 503, json: async () => ({ error: { message: 'Service unavailable' } }) });
  assert.equal(await context.estimateMealCalories(meal, 'test'), null);
  const summary = context.calorieSummary(meal);
  assert.match(summary, /Öğün kaydedildi/);
  assert.match(summary, /503/);
});

test('maintenance retries quota failures one hour later and stops after success', async () => {
  const originals = { get: context.getGitHubFile, put: context.updateGitHubFile, review: context.runDailyNutritionReview, backfill: context.backfillMissingCalories };
  let saved = {}, calls = 0;
  context.getGitHubFile = async () => ({ sha: 'state', content: JSON.stringify(saved) });
  context.updateGitHubFile = async (token, sha, content) => { saved = JSON.parse(content); };
  context.runDailyNutritionReview = async (env, now, completedDaysOnly) => {
    assert.equal(completedDaysOnly, true);
    if (++calls === 1) { const error = new Error('quota'); error.httpStatus = 429; throw error; }
  };
  context.backfillMissingCalories = async () => { throw new Error('Too early'); };
  try {
    await context.runScheduledMaintenance({}, new Date('2026-10-27T21:01:00Z'));
    assert.equal(saved.review.status, 'pending');
    assert.equal(saved.review.nextRetryAt, '2026-10-27T22:01:00.000Z');
    await context.runScheduledMaintenance({}, new Date('2026-10-27T21:30:00Z'));
    assert.equal(calls, 1);
    await context.runScheduledMaintenance({}, new Date('2026-10-27T22:01:00Z'));
    assert.equal(saved.review.status, 'done');
    await context.runScheduledMaintenance({}, new Date('2026-10-27T23:01:00Z'));
    assert.equal(calls, 2);
  } finally {
    Object.assign(context, { getGitHubFile: originals.get, updateGitHubFile: originals.put, runDailyNutritionReview: originals.review, backfillMissingCalories: originals.backfill });
  }
});

test('calorie job starts at 12:01 Turkey time and continues hourly only while pending', async () => {
  const originals = { get: context.getGitHubFile, put: context.updateGitHubFile, backfill: context.backfillMissingCalories };
  let saved = { review: { date: '2026-10-28', status: 'done' } }, calls = 0;
  context.getGitHubFile = async () => ({ sha: 'state', content: JSON.stringify(saved) });
  context.updateGitHubFile = async (token, sha, content) => { saved = JSON.parse(content); };
  context.backfillMissingCalories = async () => ({ updated: 2, remaining: ++calls === 1 ? 1 : 0 });
  try {
    await context.runScheduledMaintenance({}, new Date('2026-10-28T08:01:00Z'));
    assert.equal(calls, 0);
    await context.runScheduledMaintenance({}, new Date('2026-10-28T09:01:00Z'));
    assert.equal(calls, 1);
    assert.equal(saved.calories.nextRetryAt, '2026-10-28T10:01:00.000Z');
    await context.runScheduledMaintenance({}, new Date('2026-10-28T10:01:00Z'));
    assert.equal(saved.calories.status, 'done');
    await context.runScheduledMaintenance({}, new Date('2026-10-28T11:01:00Z'));
    assert.equal(calls, 2);
  } finally {
    Object.assign(context, { getGitHubFile: originals.get, updateGitHubFile: originals.put, backfillMissingCalories: originals.backfill });
  }
});

test('backfill merges fresh data, preserves known calories and saves partial progress on quota failure', async () => {
  const originals = { get: context.getGitHubFile, put: context.updateGitHubFile, estimate: context.estimateMealCalories };
  let reads = 0, written, attempts = 0;
  const meals = [
    { id: 'known', title: 'Pilav', calories: { min: 100, max: 200 } },
    { id: 'missing', title: 'Çorba' }, { id: 'quota', title: 'Pasta' }
  ];
  context.getGitHubFile = async (token, file) => {
    if (file !== 'data/meals/can.json') return { sha: 'test', content: '[]' };
    const latest = structuredClone(meals);
    if (++reads > 1) latest.push({ id: 'new', title: 'Yeni öğün', calories: { min: 10, max: 20 } });
    return { sha: 'latest', content: JSON.stringify([{ date: '2026-10-28', meals: latest }]) };
  };
  context.estimateMealCalories = async meal => {
    attempts++;
    if (meal.id === 'quota') { meal.calorieError = new Error('quota'); meal.calorieError.httpStatus = 429; return null; }
    return { min: 200, max: 300 };
  };
  context.updateGitHubFile = async (token, sha, content, message, path) => {
    assert.equal(path, 'data/meals/can.json');
    assert.equal(sha, 'latest');
    written = JSON.parse(content)[0].meals;
  };
  try {
    const result = await context.backfillMissingCalories({});
    assert.equal(attempts, 2);
    assert.equal(result.updated, 1);
    assert.equal(result.remaining, 1);
    assert.equal(written.find(meal => meal.id === 'known').calories.min, 100);
    assert.equal(written.find(meal => meal.id === 'missing').calories.min, 200);
    assert.ok(written.find(meal => meal.id === 'new'));
  } finally {
    Object.assign(context, { getGitHubFile: originals.get, updateGitHubFile: originals.put, estimateMealCalories: originals.estimate });
  }
});
