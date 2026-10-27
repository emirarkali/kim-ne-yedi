const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const elements = {};
const context = vm.createContext({ console, Intl, URLSearchParams,
  window: { location: { search: '' }, addEventListener() {} },
  document: { getElementById(id) { return elements[id] ||= { addEventListener() {} }; }, addEventListener() {} }
});
vm.runInContext(fs.readFileSync(`${__dirname}/../app.js`, 'utf8'), context);

test('calorie totals count known meals and never treat missing estimates as zero meals', () => {
  const totals = context.calorieTotals([{ meals: [
    { calories: { min: 400, max: 600 } }, {}, { calories: { min: 100, max: 200 } },
    { calories: { min: 500, max: 1 } }
  ] }]);
  assert.equal(totals.min, 500);
  assert.equal(totals.max, 800);
  assert.equal(totals.estimated, 2);
  assert.equal(totals.total, 4);
});

test('weekly tabs sum only meals within their selected calendar week', () => {
  const today = new Date(new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul' }).format(new Date()) + 'T12:00:00');
  const previous = new Date(today); previous.setDate(today.getDate() - 7);
  const iso = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  context.fixture = [
    { date: iso(today), meals: [{ calories: { min: 400, max: 600 } }, {}] },
    { date: iso(previous), meals: [{ calories: { min: 100, max: 200 } }] }
  ];
  vm.runInContext('allDaysData = fixture; currentStatsPeriod = "current"; computeStats()', context);
  assert.equal(elements.calorieVal.textContent, '500 kcal');
  assert.match(elements.calorieCoverage.textContent, /1\/2/);
  vm.runInContext('currentStatsPeriod = "prev"; computeStats()', context);
  assert.equal(elements.calorieVal.textContent, '150 kcal');
  vm.runInContext('currentStatsPeriod = "all"; computeStats()', context);
  assert.equal(elements.calorieVal.textContent, '650 kcal');
  vm.runInContext('allDaysData = []; computeStats()', context);
  assert.equal(elements.calorieVal.textContent, '—');
});

test('meal cards show range and safe portion text; legacy meals show missing estimate', () => {
  context.lucide = { createIcons() {} };
  context.fixture = [{ date: '2026-10-28', day: 'Çarşamba', meals: [
    { title: 'Pilav', location: 'Yurt', items: ['Pilav'], calories: { min: 400, max: 600, portions: '1 tabak <pilav>' } },
    { title: 'Çorba', location: 'Yurt', items: ['Çorba'] }
  ] }];
  vm.runInContext('allDaysData = fixture; renderTimeline()', context);
  assert.match(elements.timelineContainer.innerHTML, /Tahmini 400–600 kcal/);
  assert.match(elements.timelineContainer.innerHTML, /1 tabak &lt;pilav&gt;/);
  assert.match(elements.timelineContainer.innerHTML, /Kalori tahmini yok/);
});

test('weekly review is shared, escapes model text, and marks stale results', () => {
  const review = { status: 'ready', generatedAt: '2026-10-28T09:00:00Z', window: { start: '2026-10-22', end: '2026-10-28' },
    ranking: [{ rank: 1, id: 'can', name: 'Can', reason: '<script>bad</script>', mealCount: 10, activeDays: 5 },
      { rank: 2, id: 'emir', name: 'Emir', reason: 'Daha çeşitli.', mealCount: 2, activeDays: 1, limitedData: true }], unranked: [{ name: 'Kemal' }] };
  context.renderWeeklyReview(review, new Date('2026-10-28T10:00:00Z'));
  assert.match(elements.weeklyReviewTitle.textContent, /en sağlıksız görünen: Can/);
  assert.match(elements.weeklyReviewContent.innerHTML, /&lt;script&gt;/);
  assert.match(elements.weeklyReviewContent.innerHTML, /Sınırlı kayıt/);
  assert.match(elements.weeklyReviewContent.innerHTML, /sıralanmadı: Kemal/);
  context.renderWeeklyReview(review, new Date('2026-10-30T10:00:00Z'));
  assert.match(elements.weeklyReviewContent.innerHTML, /son başarılı sonuç/);
  context.renderWeeklyReview(null);
  assert.match(elements.weeklyReviewContent.textContent, /İlk değerlendirme bekleniyor/);
});
