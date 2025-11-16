#!/usr/bin/env node
/**
 * Database Migration Runner
 *
 * Usage:
 *   node scripts/run-migration.js <migration-file> <environment>
 *
 * Example:
 *   node scripts/run-migration.js packages/db-mysql/migrations/0003_billing_system.sql dev
 *   node scripts/run-migration.js packages/db-mysql/migrations/0003_billing_system.sql prod
 */

const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

// Database credentials
const DB_CONFIGS = {
  dev: {
    host: 'database-3.cmkyt9c4u4iq.us-east-2.rds.amazonaws.com',
    user: 'vivid_dev',
    password: 'VividAIDev2025!',
    database: 'vivid_dev'
  },
  prod: {
    host: 'database-3.cmkyt9c4u4iq.us-east-2.rds.amazonaws.com',
    user: 'vivid_prod',
    password: 'VividAIProd2025!',
    database: 'vivid_prod'
  }
};

async function runMigration() {
  // Parse arguments
  const args = process.argv.slice(2);
  if (args.length < 2) {
    console.error('Usage: node scripts/run-migration.js <migration-file> <environment>');
    console.error('Example: node scripts/run-migration.js packages/db-mysql/migrations/0003_billing_system.sql dev');
    process.exit(1);
  }

  const migrationFile = args[0];
  const environment = args[1];

  // Validate environment
  if (!['dev', 'prod'].includes(environment)) {
    console.error(`Error: Invalid environment "${environment}". Must be "dev" or "prod".`);
    process.exit(1);
  }

  // Get database config
  const dbConfig = DB_CONFIGS[environment];

  // Read migration file
  const migrationPath = path.resolve(process.cwd(), migrationFile);
  if (!fs.existsSync(migrationPath)) {
    console.error(`Error: Migration file not found: ${migrationPath}`);
    process.exit(1);
  }

  let migrationSQL = fs.readFileSync(migrationPath, 'utf8');

  // Detect migration format
  const hasDrizzleBreakpoints = migrationSQL.includes('--> statement-breakpoint');

  if (hasDrizzleBreakpoints) {
    // Handle Drizzle statement breakpoints
    migrationSQL = migrationSQL.replace(/-->\s*statement-breakpoint/g, '\n-- BREAKPOINT\n');
  }

  console.log('============================================');
  console.log('Database Migration Runner');
  console.log('============================================');
  console.log(`Environment: ${environment}`);
  console.log(`Database: ${dbConfig.database}`);
  console.log(`Host: ${dbConfig.host}`);
  console.log(`Migration: ${path.basename(migrationFile)}`);
  console.log('============================================\n');

  // Confirm before running on production
  if (environment === 'prod') {
    console.warn('⚠️  WARNING: You are about to run a migration on PRODUCTION!');
    console.warn('⚠️  This operation cannot be easily reversed.');
    console.warn('⚠️  Make sure you have a database backup!\n');

    // In a real scenario, you might want to add a confirmation prompt here
    // For now, we'll proceed with a 3-second delay
    console.log('Proceeding in 3 seconds...');
    await new Promise(resolve => setTimeout(resolve, 3000));
  }

  let connection;
  try {
    // Connect to database
    console.log('Connecting to database...');
    connection = await mysql.createConnection(dbConfig);
    console.log('✓ Connected successfully\n');

    // Run migration
    console.log('Running migration...');
    const startTime = Date.now();

    // Split SQL into individual statements based on format
    let statements = [];

    if (migrationSQL.includes('-- BREAKPOINT')) {
      // Drizzle format: split on breakpoints
      statements = migrationSQL
        .split(/--\s*(?:statement-breakpoint|BREAKPOINT)\s*\n/)
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.match(/^--[^-]/)) // Keep statements, filter standalone comments
        .map(s => s.replace(/;$/, '').trim())
        .filter(s => s.length > 0);
    } else {
      // Standard SQL format: remove comments first, then split on semicolons
      // Remove single-line comments (--) and multi-line comments (/* */)
      const cleanedSQL = migrationSQL
        .split('\n')
        .filter(line => !line.trim().startsWith('--')) // Remove comment lines
        .join('\n')
        .replace(/\/\*[\s\S]*?\*\//g, ''); // Remove multi-line comments

      statements = cleanedSQL
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0);
    }

    console.log(`Found ${statements.length} statements to execute\n`);

    let executedCount = 0;
    for (const statement of statements) {
      if (statement.trim().length === 0) continue;

      try {
        await connection.query(statement);
        executedCount++;
        if (executedCount % 5 === 0) {
          console.log(`✓ Executed ${executedCount}/${statements.length} statements...`);
        }
      } catch (error) {
        // Skip "already exists" and "duplicate" errors (for retry scenarios)
        const skipCodes = [
          'ER_TABLE_EXISTS_ERROR',    // Table already exists
          'ER_DUP_KEYNAME',            // Duplicate key name
          'ER_DUP_FIELDNAME',          // Duplicate column name
          'ER_CANT_DROP_FIELD_OR_KEY'  // Can't drop column/key that doesn't exist
        ];

        if (skipCodes.includes(error.code)) {
          console.log(`⚠ Skipping: ${error.message}`);
          executedCount++;
          continue;
        }
        // Re-throw other errors
        throw error;
      }
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`✓ Migration completed successfully in ${duration}s (${executedCount} statements)\n`);

    // Run verification queries
    console.log('Running verification queries...');

    const [subscriptionCount] = await connection.query(
      'SELECT COUNT(*) as count FROM subscriptions'
    );
    console.log(`✓ Subscriptions table: ${subscriptionCount[0].count} rows`);

    const [balanceCount] = await connection.query(
      'SELECT COUNT(*) as count FROM credit_balances'
    );
    console.log(`✓ Credit balances table: ${balanceCount[0].count} rows`);

    const [freeTierCount] = await connection.query(
      "SELECT COUNT(*) as count FROM organizations WHERE subscription_tier = 'free'"
    );
    console.log(`✓ Free tier organizations: ${freeTierCount[0].count} rows`);

    console.log('\n============================================');
    console.log('✅ Migration completed successfully!');
    console.log('============================================');

  } catch (error) {
    console.error('\n============================================');
    console.error('❌ Migration failed!');
    console.error('============================================');
    console.error('Error:', error.message);
    console.error('\nFull error:', error);

    if (error.sql) {
      console.error('\nFailing SQL:', error.sql.substring(0, 500) + '...');
    }

    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('\nDatabase connection closed.');
    }
  }
}

// Run migration
runMigration().catch(error => {
  console.error('Unexpected error:', error);
  process.exit(1);
});
