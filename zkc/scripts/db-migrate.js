// ZKCommerce Migration CLI
/**
 * ZKCommerce Database Migration CLI
 * Usage:
 *   node scripts/db-migrate.js status   -> Check current migration status & last migrated version
 *   node scripts/db-migrate.js step     -> Run the NEXT pending migration (one-by-one)
 *   node scripts/db-migrate.js up       -> Run ALL remaining pending migrations
 *   node scripts/db-migrate.js run <id> -> Run a specific migration by version or ID
 */
'use strict';
require('dotenv').config();
const {
  getMigrationStatus,
  migrateNextStep,
  migrateAllPending,
  migrateSpecific
} = require('../api/services/db-migrator');

const command = (process.argv[2] || 'status').toLowerCase();
const arg = process.argv[3];

async function main() {
  console.log('\n======================================================');
  console.log('⚡ ZKCommerce Universal Database Migration Engine v4.1');
  console.log('======================================================');

  try {
    if (command === 'status' || command === 'list') {
      const status = await getMigrationStatus();
      console.log(`\n📦 Database: ${status.database.name} (${status.database.engine})`);
      console.log(`📌 Last Migrated Version: \x1b[32m${status.summary.last_migrated_version}\x1b[0m`);
      console.log(`⏳ Next Pending Version:  \x1b[33m${status.summary.next_pending_version}\x1b[0m`);
      console.log(`📊 Progress: ${status.summary.applied_count} applied / ${status.summary.total_migrations} total (${status.summary.pending_count} pending)\n`);

      const tableData = status.migrations.map(m => ({
        Version: m.version,
        Name: m.name,
        Status: m.status === 'applied' ? '✅ APPLIED' : '⏳ PENDING',
        Batch: m.batch ? `#${m.batch}` : '—',
        AppliedAt: m.applied_at ? new Date(m.applied_at).toLocaleString() : 'Not Yet Migrated',
        Duration: m.execution_time_ms ? `${m.execution_time_ms}ms` : '—'
      }));
      console.table(tableData);

      if (status.summary.pending_count > 0) {
        console.log(`\n💡 To migrate the next version one-by-one from last done:`);
        console.log(`   \x1b[36mnpm run db:step\x1b[0m`);
        console.log(`💡 To migrate all ${status.summary.pending_count} pending versions at once:`);
        console.log(`   \x1b[36mnpm run db:migrate\x1b[0m\n`);
      } else {
        console.log('\n🎉 Database schema is fully up-to-date! No action needed.\n');
      }

    } else if (command === 'step' || command === 'next' || command === 'one') {
      console.log('\n▶ Running NEXT pending migration step (one-by-one)...');
      const res = await migrateNextStep();
      if (res.applied) {
        console.log(`\n\x1b[32m✔ SUCCESS:\x1b[0m ${res.message}`);
        console.log(`  - Version:       ${res.applied.version}`);
        console.log(`  - Name:          ${res.applied.name}`);
        console.log(`  - Batch:         #${res.applied.batch}`);
        console.log(`  - Execution:     ${res.applied.execution_time_ms}ms`);
        console.log(`  - Next Pending:  ${res.next_pending || 'None (All Done)'}`);
        console.log(`  - Remaining:     ${res.remaining_pending} pending migration(s)\n`);
      } else {
        console.log(`\nℹ ${res.message}\n`);
      }

    } else if (command === 'up' || command === 'all' || command === 'migrate') {
      console.log('\n⚡ Running ALL pending migrations...');
      const res = await migrateAllPending();
      console.log(`\n\x1b[32m✔ SUCCESS:\x1b[0m ${res.message}`);
      if (res.applied_count > 0) {
        console.log(`  Executed batch #${res.batch}:`);
        res.applied.forEach(a => console.log(`   + [${a.version}] ${a.name} (${a.execution_time_ms}ms)`));
      }
      console.log('');

    } else if (command === 'run' && arg) {
      console.log(`\n▶ Running specific migration: ${arg}...`);
      const res = await migrateSpecific(arg);
      console.log(`\n\x1b[32m✔ SUCCESS:\x1b[0m ${res.message}\n`);

    } else {
      console.log('\n❌ Unknown command.');
      console.log('Available commands:');
      console.log('  node scripts/db-migrate.js status  (Check status & last version)');
      console.log('  node scripts/db-migrate.js step    (Migrate 1 step from last done)');
      console.log('  node scripts/db-migrate.js up      (Migrate all pending)');
      console.log('  node scripts/db-migrate.js run <id> (Migrate specific version)\n');
    }

  } catch(err) {
    console.error('\n\x1b[31m❌ MIGRATION ERROR:\x1b[0m', err.message);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

main();
