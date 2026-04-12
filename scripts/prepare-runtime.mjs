import fs from 'node:fs';
import path from 'node:path';

const runtimeMode = ['production', 'test'].includes(process.env.NODE_ENV) ? process.env.NODE_ENV : 'development';
const cwd = process.cwd();
const defaultMemoryDir =
  process.platform === 'win32'
    ? 'C:/Users/deano/.openclaw/workspace/memory'
    : path.join(process.env.HOME || cwd, '.openclaw', 'workspace', 'memory');

const config = {
  mode: runtimeMode,
  host: process.env.HOSTNAME || process.env.HOST || '0.0.0.0',
  port: Number.parseInt(process.env.PORT || '3000', 10) || 3000,
  baseUrl: process.env.MISSION_CONTROL_BASE_URL || '',
  dataDir: path.resolve(process.env.MISSION_CONTROL_DATA_DIR || path.join(cwd, 'data')),
  docsDir: path.resolve(process.env.MISSION_CONTROL_DOCS_DIR || path.join(cwd, 'docs')),
  memoryDir: path.resolve(process.env.MISSION_CONTROL_MEMORY_DIR || defaultMemoryDir),
};

const requiredDataFiles = ['tasks.json', 'team.json', 'events.json'];

function ensureDir(targetPath) {
  fs.mkdirSync(targetPath, { recursive: true });
}

function seedFileIfMissing(filename) {
  const targetPath = path.join(config.dataDir, filename);
  if (fs.existsSync(targetPath)) {
    return 'existing';
  }

  const repoDefault = path.join(cwd, 'data', filename);
  if (fs.existsSync(repoDefault)) {
    fs.copyFileSync(repoDefault, targetPath);
    return 'seeded';
  }

  fs.writeFileSync(targetPath, '[]\n');
  return 'created';
}

ensureDir(config.dataDir);

const dataFiles = requiredDataFiles.map((filename) => ({
  filename,
  status: seedFileIfMissing(filename),
  path: path.join(config.dataDir, filename),
}));

const summary = {
  ...config,
  docsDirExists: fs.existsSync(config.docsDir),
  memoryDirExists: fs.existsSync(config.memoryDir),
  dataFiles,
};

console.log(JSON.stringify(summary, null, 2));
