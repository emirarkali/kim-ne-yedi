const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(`${__dirname}/../worker.js`, 'utf8').replace('export default {', 'const worker = {');
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
