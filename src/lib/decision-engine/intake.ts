import 'server-only';

import { getDb } from '@/lib/db';

export type DecisionIntakeRoute =
  | 'product-decision'
  | 'task-command'
  | 'memory-command'
  | 'conversation';

function summarizeIntent(message: string): string {
  return message.trim().replace(/\s+/g, ' ').slice(0, 500);
}

/**
 * Records the mandatory Decision Engine entry point for every chat request.
 * Product decisions continue through the full multi-option pipeline. Existing
 * explicit command handlers remain intact and are recorded as deliberate routes.
 */
export async function recordDecisionIntake(input: {
  chatMessageId: string;
  message: string;
  route: DecisionIntakeRoute;
  requiresApproval: boolean;
}): Promise<void> {
  const sql = getDb();
  await sql`
    INSERT INTO mission_control.decision_intake_events (
      chat_message_id, route, understood_intent, requires_approval
    )
    VALUES (
      ${input.chatMessageId},
      ${input.route},
      ${summarizeIntent(input.message)},
      ${input.requiresApproval}
    )
  `;
}

export async function linkDecisionIntakeToOrchestration(
  chatMessageId: string,
  orchestrationRequestId: string,
): Promise<void> {
  const sql = getDb();
  await sql`
    UPDATE mission_control.decision_intake_events
    SET orchestration_request_id = ${orchestrationRequestId}
    WHERE chat_message_id = ${chatMessageId}
  `;
}
