import 'server-only';

import { getDb } from '@/lib/db';

export interface ContinuousLearningSnapshot {
  routingEvents: number;
  routingSuccessRate: number | null;
  averageLatencyMs: number | null;
  approvals: number;
  changeRequests: number;
  researchReports: number;
  changedRecommendations: number;
  explanation: string;
}

/**
 * Learning in Sprint 1.5 is evidence-based scoring, not self-modifying code.
 * Capability routing consumes recent success data and future recommendations
 * can explain changes using saved report and outcome history.
 */
export async function getContinuousLearningSnapshot(): Promise<ContinuousLearningSnapshot> {
  const sql = getDb();
  const [row] = await sql<{
    routing_events: string | number;
    routing_success_rate: string | number | null;
    average_latency_ms: string | number | null;
    approvals: string | number;
    change_requests: string | number;
    research_reports: string | number;
    changed_recommendations: string | number;
  }[]>`
    SELECT
      (SELECT COUNT(*) FROM mission_control.model_routing_events) AS routing_events,
      (
        SELECT AVG(CASE WHEN success THEN 1.0 WHEN success = FALSE THEN 0.0 END)
        FROM mission_control.model_routing_events
      ) AS routing_success_rate,
      (
        SELECT AVG(latency_ms)
        FROM mission_control.model_routing_events
        WHERE latency_ms IS NOT NULL
      ) AS average_latency_ms,
      (
        SELECT COUNT(*)
        FROM mission_control.decision_outcomes
        WHERE outcome_type = 'approved'
      ) AS approvals,
      (
        SELECT COUNT(*)
        FROM mission_control.decision_outcomes
        WHERE outcome_type = 'changes-requested'
      ) AS change_requests,
      (SELECT COUNT(*) FROM mission_control.research_reports) AS research_reports,
      (
        SELECT COUNT(*)
        FROM mission_control.research_reports
        WHERE change_explanation IS NOT NULL AND change_explanation <> ''
      ) AS changed_recommendations
  `;
  const routingEvents = Number(row.routing_events);
  const approvals = Number(row.approvals);
  const changeRequests = Number(row.change_requests);
  const researchReports = Number(row.research_reports);
  const changedRecommendations = Number(row.changed_recommendations);
  const routingSuccessRate = row.routing_success_rate === null
    ? null
    : Number(row.routing_success_rate);
  const averageLatencyMs = row.average_latency_ms === null
    ? null
    : Math.round(Number(row.average_latency_ms));

  return {
    routingEvents,
    routingSuccessRate,
    averageLatencyMs,
    approvals,
    changeRequests,
    researchReports,
    changedRecommendations,
    explanation: routingEvents === 0 && approvals === 0
      ? 'The learning framework is ready. Scores will change only after real routing and user-decision outcomes are recorded.'
      : `Routing now uses ${routingEvents} measured event${routingEvents === 1 ? '' : 's'}, while recommendations can learn from ${approvals} approval${approvals === 1 ? '' : 's'} and ${changeRequests} requested revision${changeRequests === 1 ? '' : 's'}.`,
  };
}
