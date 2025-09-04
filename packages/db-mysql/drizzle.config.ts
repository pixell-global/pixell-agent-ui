import { defineConfig } from 'drizzle-kit'

const credentials: any = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  database: process.env.DB_NAME || 'pixell_auth',
}
// Only include password if it is provided; some local MySQL setups have no password for root
if (process.env.DB_PASSWORD !== undefined) {
  credentials.password = process.env.DB_PASSWORD
}

export default defineConfig({
  schema: './src/schema.ts',
  out: './migrations',
  dialect: 'mysql',
  dbCredentials: credentials,
})


