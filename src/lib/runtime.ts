import fs from 'fs';
import path from 'path';

type RuntimeMode = 'development' | 'production' | 'test';

interface RuntimeConfig {
  mode: RuntimeMode;
  host: string;
  port: number;
  baseUrl: string | null;
  dataDir: string;
  docsDir: string;
  memoryDir: string;
}

const DEFAULT_MEMORY_DIR =
  process.platform === 'win32'
    ? 'C:/Users/deano/.openclaw/workspace/memory'
    : path.join(process.env.HOME || process.cwd(), '.openclaw', 'workspace', 'memory');

function normalizeRuntimeMode(value: string | undefined): RuntimeMode {
  if (value === 'production' || value === 'test') {
    return value;
  }

  return 'development';
}

function parsePort(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(value || '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function resolveDir(value: string | undefined, fallbackSegments: string[]) {
  if (value) {
    return path.resolve(value);
  }

  return path.join(/* turbopackIgnore: true */ process.cwd(), ...fallbackSegments);
}

export function getRuntimeConfig(): RuntimeConfig {
  const mode = normalizeRuntimeMode(process.env.NODE_ENV);
  const host = process.env.HOSTNAME || process.env.HOST || '0.0.0.0';
  const port = parsePort(process.env.PORT, 3000);

  return {
    mode,
    host,
    port,
    baseUrl: process.env.MISSION_CONTROL_BASE_URL || null,
    dataDir: resolveDir(process.env.MISSION_CONTROL_DATA_DIR, ['data']),
    docsDir: resolveDir(process.env.MISSION_CONTROL_DOCS_DIR, ['docs']),
    memoryDir: path.resolve(process.env.MISSION_CONTROL_MEMORY_DIR || DEFAULT_MEMORY_DIR),
  };
}

export function ensureDir(dirPath: string) {
  fs.mkdirSync(dirPath, { recursive: true });
}

export function resolveDataPath(filename: string) {
  return path.join(getRuntimeConfig().dataDir, filename);
}

export function resolveDocsPath(...segments: string[]) {
  return path.join(getRuntimeConfig().docsDir, ...segments);
}

export function resolveMemoryPath(...segments: string[]) {
  return path.join(getRuntimeConfig().memoryDir, ...segments);
}

export function pathExists(targetPath: string) {
  return fs.existsSync(targetPath);
}

export function isWritable(targetPath: string) {
  try {
    fs.accessSync(targetPath, fs.constants.W_OK);
    return true;
  } catch {
    return false;
  }
}
