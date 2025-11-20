#!/usr/bin/env node
const mysql = require('mysql2/promise');

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

async function checkTables() {
  const env = process.argv[2] || 'dev';
  const config = DB_CONFIGS[env];

  const connection = await mysql.createConnection(config);

  console.log(`\nChecking tables in ${env} (${config.database}):\n`);

  const [tables] = await connection.query('SHOW TABLES');
  console.log(`Found ${tables.length} tables:\n`);
  tables.forEach((row, index) => {
    const tableName = Object.values(row)[0];
    console.log(`${index + 1}. ${tableName}`);
  });

  await connection.end();
}

checkTables().catch(console.error);
