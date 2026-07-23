import 'server-only';

import type { ResearchSignal } from '@/lib/research-engine/types';

const DEFAULT_RESEARCH_SOURCES = [
  'https://developers.openai.com/api/docs/models',
  'https://platform.claude.com/docs/en/about-claude/pricing',
  'https://platform.kimi.com/docs/llms.txt',
  'https://nextjs.org/blog',
  'https://github.blog/changelog/',
  'https://github.com/mem0ai/mem0/releases.atom',
  'https://export.arxiv.org/api/query?search_query=cat:cs.AI&start=0&max_results=10&sortBy=submittedDate&sortOrder=descending',
];

function configuredSources(): string[] {
  const custom = process.env.RESEARCH_SOURCE_URLS
    ?.split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  return custom && custom.length > 0 ? custom : DEFAULT_RESEARCH_SOURCES;
}

function safeResearchUrl(value: string): URL | null {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:') return null;
    const host = url.hostname.toLowerCase();
    if (
      host === 'localhost'
      || host === '127.0.0.1'
      || host === '::1'
      || host.endsWith('.local')
      || /^10\./.test(host)
      || /^192\.168\./.test(host)
      || /^172\.(1[6-9]|2\d|3[01])\./.test(host)
    ) return null;
    return url;
  } catch {
    return null;
  }
}

function plainText(value: string): string {
  return value
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 12_000);
}

function extractTitle(value: string, fallback: string): string {
  const htmlTitle = value.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1];
  const markdownTitle = value.match(/^#\s+(.+)$/m)?.[1];
  return plainText(htmlTitle || markdownTitle || fallback).slice(0, 200);
}

async function fetchSignal(value: string): Promise<ResearchSignal> {
  const fetchedAt = new Date().toISOString();
  const url = safeResearchUrl(value);
  if (!url) {
    return {
      url: value,
      title: value,
      excerpt: '',
      fetchedAt,
      lastModified: null,
      status: 'unavailable',
      error: 'Source URL was rejected by the research safety policy.',
    };
  }

  try {
    const response = await fetch(url, {
      headers: {
        Accept: 'text/html, text/plain, application/xml, application/atom+xml;q=0.9',
        'User-Agent': 'MissionControl-ResearchEngine/1.0',
      },
      signal: AbortSignal.timeout(15_000),
      cache: 'no-store',
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const body = await response.text();
    return {
      url: url.toString(),
      title: extractTitle(body, url.hostname),
      excerpt: plainText(body),
      fetchedAt,
      lastModified: response.headers.get('last-modified'),
      status: 'available',
    };
  } catch (error) {
    return {
      url: url.toString(),
      title: url.hostname,
      excerpt: '',
      fetchedAt,
      lastModified: null,
      status: 'unavailable',
      error: error instanceof Error ? error.message : 'Unknown fetch error',
    };
  }
}

export async function collectResearchSignals(): Promise<ResearchSignal[]> {
  return Promise.all(configuredSources().slice(0, 12).map(fetchSignal));
}
