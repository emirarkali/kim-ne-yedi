import { readFile, writeFile, rename } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

import { generateReview } from '../telegram-bot/worker.js';
export { reviewWindow, collectMeals, validateRanking, generateReview } from '../telegram-bot/worker.js';

async function main() {
  const users = JSON.parse(await readFile('data/users.json', 'utf8'));
  const records = Object.fromEntries(await Promise.all(users.map(async user => {
    if (!/^data\/meals\/[a-z0-9_-]+\.json$/.test(user.file)) throw new Error('Geçersiz profil dosyası');
    return [user.id, JSON.parse(await readFile(user.file, 'utf8'))];
  })));
  const result = await generateReview({ users, records, apiKey: process.env.GEMINI_API_KEY });
  // Only replace a previous successful result after the entire response validates.
  await writeFile('data/weekly-review.json.tmp', JSON.stringify(result, null, 2) + '\n');
  await rename('data/weekly-review.json.tmp', 'data/weekly-review.json');
  console.log(`Değerlendirme kaydedildi: ${result.window.start} – ${result.window.end}, ${result.ranking.length} kişi`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
