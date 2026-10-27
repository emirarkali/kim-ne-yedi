import { test } from 'node:test';
import assert from 'node:assert/strict';
import { reviewWindow, collectMeals, validateRanking, generateReview } from '../scripts/weekly-review.mjs';
const now = new Date('2026-10-27T22:00:00Z');
const users = [{ id: 'can', name: 'Can' }, { id: 'emir', name: 'Emir' }, { id: 'kemal', name: 'Kemal' }];
const records = {
  can: [{ date: '2026-10-21', meals: [{ id: 'old', title: 'Eski' }] },
    { date: '2026-10-22', meals: [{ id: 'c1', title: 'Hamburger' }] },
    { date: '2026-10-28', meals: [{ id: 'c2', title: 'Kola' }] },
    { date: '2026-10-29', meals: [{ id: 'future', title: 'Yeni' }] }],
  emir: [{ date: '2026-10-28', meals: [{ id: 'e1', title: 'Fasulye' }] }], kemal: []
};
const ranking = [
  { id: 'can', reason: 'Kayıtlı seçimlerinde işlenmiş gıda var.', mealIds: ['c1'] },
  { id: 'emir', reason: 'Sınırlı kayıtta baklagil var.', mealIds: ['e1'] }
];

test('rolling window uses Istanbul date across UTC midnight and month/year boundaries', () => {
  assert.deepEqual(reviewWindow(now), { start: '2026-10-22', end: '2026-10-28' });
  assert.deepEqual(reviewWindow(new Date('2026-12-31T21:01:00Z')), { start: '2026-12-26', end: '2027-01-01' });
});

test('includes boundary days but excludes old/future meals and empty profiles', () => {
  const profiles = collectMeals(users, records, reviewWindow(now));
  assert.deepEqual(profiles[0].meals.map(meal => meal.id), ['c1', 'c2']);
  assert.equal(profiles[0].activeDays, 2);
  assert.equal(profiles[2].mealCount, 0);
  const result = validateRanking({ ranking }, profiles);
  assert.equal(result[0].name, 'Can');
  assert.equal(result[0].limitedData, true);
});

test('rejects missing/duplicate/invented users and fabricated supporting meals', () => {
  const profiles = collectMeals(users, records, reviewWindow(now));
  for (const bad of [[], [ranking[0], ranking[0]], [{ ...ranking[0], id: 'other' }, ranking[1]],
    [{ ...ranking[0], mealIds: ['e1'] }, ranking[1]], [{ ...ranking[0], reason: '' }, ranking[1]]]) {
    assert.throws(() => validateRanking({ ranking: bad }, profiles));
  }
});

test('successful model response preserves exact coverage and unranked people', async () => {
  const result = await generateReview({ users, records, now, apiKey: 'test', request: async () => ({ ok: true,
    json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify({ ranking }) }] } }] }) }) });
  assert.equal(result.status, 'ready');
  assert.equal(result.ranking.length, 2);
  assert.equal(result.unranked[0].id, 'kemal');
  assert.equal(result.generatedAt, now.toISOString());
});

test('insufficient data skips AI; API failure never creates a fabricated ranking', async () => {
  const request = async () => { throw new Error('offline'); };
  const empty = await generateReview({ users, records: { can: [], emir: [], kemal: [] }, now, request });
  assert.equal(empty.status, 'insufficient_data');
  assert.deepEqual(empty.ranking, []);
  await assert.rejects(generateReview({ users, records, now, apiKey: 'test', request }), /offline/);
});
