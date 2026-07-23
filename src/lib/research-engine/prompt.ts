import { CONSTITUTION_PROMPT } from '@/lib/constitution';
import type { ResearchSignal } from '@/lib/research-engine/types';

export function buildResearchMessages(input: {
  signals: ResearchSignal[];
  previousResearchMemory: string;
  learningContext: string;
}) {
  const available = input.signals.filter((signal) => signal.status === 'available');
  const system = [
    'You are Mission Control\'s weekly Research Engine.',
    CONSTITUTION_PROMPT,
    'Evaluate meaningful changes; do not create a news dump.',
    'Cover relevant AI models, frameworks, automation, memory systems, developer tools, research papers, open-source projects, and infrastructure.',
    'Recommend adoption only when the evidence and expected impact justify migration.',
    'Never claim a technology was adopted. Every report remains pending user review.',
    'Use only the source URLs supplied below. Do not invent sources, benchmarks, prices, or changes.',
    'If evidence is too weak, return no report for that item.',
    'Return one valid JSON object only, without markdown.',
  ].join('\n');

  const shape = {
    summary: 'Plain-English weekly conclusion',
    reports: [{
      category: 'AI models | frameworks | automation | memory | developer tools | research | open source | infrastructure',
      technology: 'Technology name',
      title: 'Recommendation report title',
      whatChanged: 'Verified change from supplied evidence',
      whyItMatters: 'Why Mission Control should care',
      advantages: ['Advantage'],
      disadvantages: ['Disadvantage'],
      expectedImpact: 'Expected effect on Mission Control',
      migrationDifficulty: 'Low, medium, or high with explanation',
      costImplications: 'Known cost, estimate, or clearly stated unknown',
      recommendation: 'recommended | optional | not-recommended',
      recommendationRationale: 'Why this conclusion follows',
      changeExplanation: 'How and why this differs from an earlier recommendation, or null',
      sourceLinks: ['https://source.example'],
    }],
  };

  const user = [
    'SOURCE SNAPSHOTS:',
    ...available.map((signal) => [
      `URL: ${signal.url}`,
      `Title: ${signal.title}`,
      `Fetched: ${signal.fetchedAt}`,
      `Last modified: ${signal.lastModified ?? 'not supplied'}`,
      `Excerpt: ${signal.excerpt}`,
    ].join('\n')),
    '',
    `PREVIOUS RESEARCH MEMORY:\n${input.previousResearchMemory}`,
    '',
    `MEASURED OUTCOMES:\n${input.learningContext}`,
    '',
    'Return this exact JSON structure. Zero reports is valid when no meaningful, supported change exists:',
    JSON.stringify(shape),
  ].join('\n\n');

  return [
    { role: 'system' as const, content: system },
    { role: 'user' as const, content: user },
  ];
}
