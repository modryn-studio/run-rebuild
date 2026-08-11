// Server-only DB client. Re-exports the schema, so `@/lib/db` is the one import for both
// the connection and the tables.
import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import { env } from '@/lib/env';
import * as schema from './schema';

const sql = neon(env.DATABASE_URL);

export const db = drizzle(sql, { schema });

export * from './schema';
