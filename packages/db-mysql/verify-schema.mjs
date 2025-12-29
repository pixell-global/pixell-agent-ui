import mysql from 'mysql2/promise'

const config = {
  host: process.env.DB_HOST || 'database-3.cmkyt9c4u4iq.us-east-2.rds.amazonaws.com',
  user: process.env.DB_USER || 'vivid_dev',
  password: process.env.DB_PASSWORD || 'VividAIDev2025!',
  database: process.env.DB_NAME || 'vivid_dev',
}

async function verifySchema() {
  const connection = await mysql.createConnection(config)

  try {
    const [columns] = await connection.query('SHOW COLUMNS FROM schedules')

    console.log('Schedules table columns:')
    columns.forEach(col => {
      console.log(`  - ${col.Field} (${col.Type})`)
    })

    const hasExecutionPlan = columns.some(col => col.Field === 'execution_plan')
    console.log(`\n✅ execution_plan column exists: ${hasExecutionPlan}`)
  } finally {
    await connection.end()
  }
}

verifySchema()
