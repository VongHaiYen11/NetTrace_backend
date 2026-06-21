import { initClickHousePerformanceColumns } from './init-performance-columns.js';
import { clickhouseClient } from './connection.js';

async function run() {
  try {
    await initClickHousePerformanceColumns();
    console.log('ClickHouse performance columns initialized!');
  } catch (err) {
    console.error('ClickHouse initialization failed:', err);
    process.exit(1);
  } finally {
    await clickhouseClient.close();
  }
}

run();
