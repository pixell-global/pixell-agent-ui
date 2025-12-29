import mysql from 'mysql2/promise'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const config = {
  host: process.env.DB_HOST || 'database-3.cmkyt9c4u4iq.us-east-2.rds.amazonaws.com',
  user: process.env.DB_USER || 'vivid_dev',
  password: process.env.DB_PASSWORD || 'VividAIDev2025!',
  database: process.env.DB_NAME || 'vivid_dev',
}

async function runMigration() {
  const connection = await mysql.createConnection(config)

  try {
    console.log('Connected to database')

    // Read and execute the migration
    const migrationPath = join(__dirname, 'migrations', '0012_add_execution_plan.sql')
    const sql = readFileSync(migrationPath, 'utf8')

    console.log('Executing migration:', sql)
    await connection.query(sql)

    console.log('✅ Migration completed successfully')
  } catch (error) {
    if (error.code === 'ER_DUP_FIELDNAME') {
      console.log('⚠️  Column already exists, skipping migration')
    } else {
      console.error('❌ Migration failed:', error.message)
      throw error
    }
  } finally {
    await connection.end()
  }
}

runMigration()
