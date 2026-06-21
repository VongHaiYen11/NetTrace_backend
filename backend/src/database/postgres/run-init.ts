import { initTemplateTables } from './init-templates.js';
import { initPerformanceIndexes } from './init-performance-indexes.js';
import { pgPool } from './connection.js';

async function run() {
  try {
    await initTemplateTables();
    await initPerformanceIndexes();
    console.log('Tables initialized!');
  } catch (err) {
    console.error('Initialization failed:', err);
    process.exit(1);
  } finally {
    await pgPool.end();
  }
}

run();
