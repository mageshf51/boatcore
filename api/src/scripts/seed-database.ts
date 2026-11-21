import { createRepository } from '../repositories/state-repository.ts';
import { seed } from '../services/seed-service.ts';
const repo = await createRepository();
try {
  await repo.transaction((s) => seed(s, process.env.SEED_SAMPLE_DATA === 'true', false));
  console.log('Seed complete. Existing business data was preserved.');
} finally {
  await repo.close();
}
