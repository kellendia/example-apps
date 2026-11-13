import { DatabaseSync } from 'node:sqlite';
import { drizzle } from 'drizzle-orm/node-sqlite';
import { migrate } from 'drizzle-orm/node-sqlite/migrator';
import { DATABASE_PATH } from '../config/env.config.ts';

const sqlite = new DatabaseSync(DATABASE_PATH);
export const db = drizzle({ client: sqlite });

// Creates/updates tables on boot so `npm run dev` works right after `npm install` —
// no separate migrate step needed. Safe to run on every start.
migrate(db, { migrationsFolder: new URL('./migrations', import.meta.url).pathname });
