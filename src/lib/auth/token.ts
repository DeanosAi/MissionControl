import 'server-only';

import { jwtVerify, SignJWT } from 'jose';

import { getAuthEnvSafe } from '@/lib/auth/env';
import { SESSION_DURATION_SECONDS } from '@/lib/auth/constants';

export interface SessionTokenPayload {
  sid: string;
  sub: string;
  email: string;
}

function getSecretKey(): Uint8Array | null {
  const env = getAuthEnvSafe();
  if (!env) {
    return null;
  }

  return new TextEncoder().encode(env.SESSION_SECRET);
}

export async function signSessionToken(payload: SessionTokenPayload): Promise<string> {
  const secretKey = getSecretKey();

  if (!secretKey) {
    throw new Error('Auth environment is not configured.');
  }

  return new SignJWT({
    email: payload.email,
    sid: payload.sid,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DURATION_SECONDS}s`)
    .sign(secretKey);
}

export async function verifySessionToken(token: string | undefined): Promise<SessionTokenPayload | null> {
  const secretKey = getSecretKey();

  if (!secretKey || !token) {
    return null;
  }

  try {
    const { payload } = await jwtVerify(token, secretKey, {
      algorithms: ['HS256'],
    });

    if (typeof payload.sid !== 'string' || typeof payload.sub !== 'string' || typeof payload.email !== 'string') {
      return null;
    }

    return {
      sid: payload.sid,
      sub: payload.sub,
      email: payload.email,
    };
  } catch {
    return null;
  }
}
