import fs from 'fs';
import { ensureDir, getRuntimeConfig, resolveDataPath } from '@/lib/runtime';

export function readJsonFile<T>(filePath: string, fallback: T): T {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as T;
  } catch {
    return fallback;
  }
}

export function writeJsonFile<T>(filePath: string, value: T) {
  ensureDir(getRuntimeConfig().dataDir);
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

export function readDataFile<T>(filename: string, fallback: T): T {
  return readJsonFile(resolveDataPath(filename), fallback);
}
