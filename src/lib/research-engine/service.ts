import 'server-only';

import {
  CostApprovalRequiredError,
  completeWithCapability,
} from '@/lib/conversational-bridge/model-router';
import { createJournalEntry } from '@/lib/journal';
import { getDecisionLearningContext } from '@/lib/decision-engine/repository';
import { runMemoryAgeingLifecycle } from '@/lib/memory-domains/lifecycle';
import { rememberResearchMemory } from '@/lib/memory-domains/research-memory';
import { getUnifiedMemoryContext } from '@/lib/memory-domains/retrieval';
import { buildResearchMessages } from '@/lib/research-engine/prompt';
import {
  completeResearchRun,
  createResearchRun,
  saveResearchReports,
} from '@/lib/research-engine/repository';
import { collectResearchSignals } from '@/lib/research-engine/sources';
import {
  researchEngineOutputSchema,
  type ResearchEngineOutput,
  type ResearchReportRecord,
} from '@/lib/research-engine/types';

const RESEARCH_TOPICS = [
  'AI models',
  'development frameworks',
  'automation platforms',
  'memory systems',
  'developer tools',
  'research papers',
  'open-source projects',
  'infrastructure improvements',
];

function extractJson(value: string): unknown {
  const trimmed = value.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('Research model did not return structured JSON.');
  return JSON.parse(trimmed.slice(start, end + 1));
}

function unavailableOutput(availableSources: number): ResearchEngineOutput {
  return {
    summary: availableSources > 0
      ? 'Research sources were collected, but no configured evaluation model produced a trustworthy report. Mission Control made no adoption recommendation.'
      : 'No approved research source could be retrieved this week. Mission Control made no adoption recommendation.',
    reports: [],
  };
}

export interface WeeklyResearchResult {
  runId: string;
  status: 'completed' | 'partial' | 'cost-approval-required';
  summary: string;
  reports: ResearchReportRecord[];
}

export async function runWeeklyResearchEngine(
  trigger: 'weekly' | 'manual' = 'weekly',
): Promise<WeeklyResearchResult> {
  const signals = await collectResearchSignals();
  const runId = await createResearchRun({
    trigger,
    topics: RESEARCH_TOPICS,
    signals,
  });
  const availableSources = signals.filter((signal) => signal.status === 'available').length;

  try {
    const [previousResearchMemory, learningContext] = await Promise.all([
      getUnifiedMemoryContext({
        query: RESEARCH_TOPICS.join(' '),
        domains: ['research', 'decision', 'operational'],
        limit: 30,
      }),
      getDecisionLearningContext(30),
      runMemoryAgeingLifecycle(),
    ]);
    const promptInput = { signals, previousResearchMemory, learningContext };
    let output: ResearchEngineOutput;
    let status: WeeklyResearchResult['status'] = 'completed';
    let routingDecision: Record<string, unknown> | null = null;

    try {
      const completion = await completeWithCapability(
        'research',
        () => buildResearchMessages(promptInput),
        6000,
        { estimatedInputTokens: 20_000 },
      );
      routingDecision = completion.routingDecision;
      output = researchEngineOutputSchema.parse(extractJson(completion.content));
    } catch (error) {
      if (error instanceof CostApprovalRequiredError) {
        const estimate = error.routingDecision.selected.estimatedCostUsd;
        const summary = `Weekly research paused before model evaluation because the estimated cost ${estimate === null ? 'is unknown' : `of $${estimate.toFixed(4)}`} exceeds the $${error.routingDecision.costThresholdUsd.toFixed(4)} approval threshold. No technology was adopted.`;
        await completeResearchRun({
          id: runId,
          status: 'cost-approval-required',
          summary,
          routingDecision: {
            capability: error.routingDecision.capability,
            selectedModelId: error.routingDecision.selected.id,
            estimatedCostUsd: estimate,
            costThresholdUsd: error.routingDecision.costThresholdUsd,
          },
        });
        await createJournalEntry({
          title: 'Weekly Research Engine paused for cost approval',
          detail: summary,
          entryType: 'decision',
          source: 'research-engine/cost-pause',
        });
        return { runId, status: 'cost-approval-required', summary, reports: [] };
      }
      output = unavailableOutput(availableSources);
      status = 'partial';
      await createJournalEntry({
        title: 'Weekly Research Engine used safe fallback',
        detail: `${output.summary}\nReason: ${error instanceof Error ? error.message : 'Unknown research evaluation failure'}`,
        entryType: 'auto',
        source: 'research-engine/recovery',
      });
    }

    const reports = await saveResearchReports(runId, output.reports);
    for (const report of reports) {
      await rememberResearchMemory({
        key: `research-${report.technology.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
        title: report.title,
        content: [
          `What changed: ${report.whatChanged}`,
          `Why it matters: ${report.whyItMatters}`,
          `Advantages: ${report.advantages.join('; ')}`,
          `Disadvantages: ${report.disadvantages.join('; ')}`,
          `Expected impact: ${report.expectedImpact}`,
          `Migration difficulty: ${report.migrationDifficulty}`,
          `Cost implications: ${report.costImplications}`,
          `Recommendation: ${report.recommendation}. ${report.recommendationRationale}`,
        ].join('\n'),
        summary: `${report.recommendation}: ${report.recommendationRationale}`,
        source: 'research-engine/weekly-report',
        importance: report.recommendation === 'recommended' ? 8 : 6,
        metadata: {
          researchRunId: runId,
          reportId: report.id,
          recommendation: report.recommendation,
          sources: report.sourceLinks,
          adoptionStatus: 'pending-review',
        },
      });
    }

    await completeResearchRun({
      id: runId,
      status,
      summary: output.summary,
      routingDecision,
    });
    await createJournalEntry({
      title: `Weekly technology research ${status === 'completed' ? 'completed' : 'completed with limited evaluation'}`,
      detail: `${output.summary}\n${reports.length} evaluated recommendation report${reports.length === 1 ? '' : 's'} created. Every report remains pending user review; no technology was adopted.`,
      entryType: 'auto',
      source: 'research-engine/weekly',
    });
    return { runId, status, summary: output.summary, reports };
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'Unknown Research Engine failure';
    await completeResearchRun({
      id: runId,
      status: 'failed',
      summary: 'Weekly research failed safely. No technology was adopted.',
      error: reason,
    });
    await createJournalEntry({
      title: 'Weekly Research Engine failed safely',
      detail: `${reason}\nNo technology was adopted.`,
      entryType: 'ops',
      source: 'research-engine/failure',
    }).catch(() => undefined);
    throw error;
  }
}
