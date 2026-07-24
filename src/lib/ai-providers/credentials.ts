import 'server-only';

import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12;

export interface EncryptedProviderSecret {
  encryptedSecret: string;
  initializationVector: string;
  authenticationTag: string;
  fingerprint: string;
}

function getEncryptionKey(): Buffer {
  const configured = process.env.PROVIDER_CREDENTIALS_KEY?.trim();
  if (!configured) {
    throw new Error(
      'Provider credential storage is not enabled. Configure PROVIDER_CREDENTIALS_KEY with a base64-encoded 32-byte key.',
    );
  }

  const key = Buffer.from(configured, 'base64');
  if (key.length !== 32) {
    throw new Error('PROVIDER_CREDENTIALS_KEY must decode to exactly 32 bytes.');
  }
  return key;
}

export function canStoreProviderCredentials(): boolean {
  try {
    getEncryptionKey();
    return true;
  } catch {
    return false;
  }
}

export function providerSecretFingerprint(secret: string): string {
  return createHash('sha256').update(secret).digest('hex').slice(-8).toUpperCase();
}

export function encryptProviderSecret(secret: string): EncryptedProviderSecret {
  const value = secret.trim();
  if (!value) throw new Error('Enter an API key.');

  const initializationVector = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, getEncryptionKey(), initializationVector);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);

  return {
    encryptedSecret: encrypted.toString('base64'),
    initializationVector: initializationVector.toString('base64'),
    authenticationTag: cipher.getAuthTag().toString('base64'),
    fingerprint: providerSecretFingerprint(value),
  };
}

export function decryptProviderSecret(input: {
  encryptedSecret: string;
  initializationVector: string;
  authenticationTag: string;
}): string {
  const decipher = createDecipheriv(
    ALGORITHM,
    getEncryptionKey(),
    Buffer.from(input.initializationVector, 'base64'),
  );
  decipher.setAuthTag(Buffer.from(input.authenticationTag, 'base64'));
  return Buffer.concat([
    decipher.update(Buffer.from(input.encryptedSecret, 'base64')),
    decipher.final(),
  ]).toString('utf8');
}

