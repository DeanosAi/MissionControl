import 'server-only';

import { z } from 'zod';

const authEnvSchema = z.object({
  ADMIN_EMAIL: z.string().email(),
  ADMIN_PASSWORD_HASH: z.string().min(20),
  SESSION_SECRET: z.string().min(32),
});

export type AuthEnv = z.infer<typeof authEnvSchema>;

function readAuthEnv() {
  return {
    ADMIN_EMAIL: process.env.ADMIN_EMAIL,
    ADMIN_PASSWORD_HASH: process.env.ADMIN_PASSWORD_HASH,
    SESSION_SECRET: process.env.SESSION_SECRET,
  };
}

export function getAuthEnv(): AuthEnv {
  return authEnvSchema.parse(readAuthEnv());
}

export function getAuthEnvSafe(): AuthEnv | null {
  const parsed = authEnvSchema.safeParse(readAuthEnv());
  return parsed.success ? parsed.data : null;
}
