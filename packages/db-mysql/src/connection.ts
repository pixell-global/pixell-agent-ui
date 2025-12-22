import { drizzle } from 'drizzle-orm/mysql2'
import mysql from 'mysql2'

type MySql2DrizzleDb = ReturnType<typeof drizzle>

let cachedDb: MySql2DrizzleDb | undefined
let cachedPool: mysql.Pool | undefined

/**
 * Lazily creates and returns a singleton Drizzle DB instance.
 * Note: Return type is intentionally non-null to keep repository code simple under `strict` mode.
 */
export async function getDb(): Promise<MySql2DrizzleDb> {
  if (cachedDb) return cachedDb

  const port = process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : 3306
  const connectionLimit = process.env.DB_POOL_SIZE ? parseInt(process.env.DB_POOL_SIZE, 10) : 10
  const maxIdle = process.env.DB_POOL_MAX_IDLE ? parseInt(process.env.DB_POOL_MAX_IDLE, 10) : connectionLimit
  const idleTimeout = process.env.DB_POOL_IDLE_TIMEOUT_MS ? parseInt(process.env.DB_POOL_IDLE_TIMEOUT_MS, 10) : 60_000

  cachedPool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port,
    waitForConnections: true,
    connectionLimit,
    maxIdle,
    idleTimeout,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0,
  })

  cachedDb = drizzle(cachedPool)
  return cachedDb
}

export type DrizzleDb = Awaited<ReturnType<typeof getDb>>


