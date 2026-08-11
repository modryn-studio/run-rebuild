import { config } from 'dotenv';
import { defineConfig } from 'drizzle-kit';

// drizzle-kit is a standalone CLI — Next's automatic .env.local loading doesn't apply,
// so load it here explicitly.
config({ path: '.env.local' });

export default defineConfig({
  schema: './src/lib/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: { url: process.env.DATABASE_URL! },
  strict: true,
  verbose: true,
});
