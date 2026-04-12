import { z } from 'zod';

const databaseUrlSchema = z
  .string()
  .url()
  .refine((value) => {
    const protocol = new URL(value).protocol;
    return protocol === 'postgres:' || protocol === 'postgresql:';
  }, 'DATABASE_URL must use the postgres:// or postgresql:// protocol');

const databaseEnvSchema = z.object({
  DATABASE_URL: databaseUrlSchema,
});

export type DatabaseEnv = z.infer<typeof databaseEnvSchema>;

export function getDatabaseEnv(): DatabaseEnv {
  return databaseEnvSchema.parse({
    DATABASE_URL: process.env.DATABASE_URL,
  });
}
