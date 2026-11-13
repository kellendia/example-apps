import { config } from 'dotenv';
import { z } from 'zod';

const envSchema = z.object({
  PORT: z.coerce.number().default(43902),
  NOMBA_ACCOUNT_ID: z.string(),
  NOMBA_CLIENT_ID: z.string(),
  NOMBA_CLIENT_SECRET: z.string(),
  NOMBA_ENVIRONMENT: z.enum(['sandbox', 'production']).default('sandbox'),
  NOMBA_WEBHOOK_SECRET: z.string(),
  DATABASE_PATH: z.string().default('./webhooks.db'),
});

config();

export const {
    PORT,
    NOMBA_ACCOUNT_ID,
    NOMBA_CLIENT_ID,
    NOMBA_CLIENT_SECRET,
    NOMBA_ENVIRONMENT,
    NOMBA_WEBHOOK_SECRET,
    DATABASE_PATH,
} = envSchema.parse(process.env);