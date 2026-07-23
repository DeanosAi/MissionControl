'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { requireAdminSession } from '@/lib/auth/session';
import {
  approveConversationProposal,
  reviseConversationProposal,
} from '@/lib/conversational-bridge/service';
import type { OrchestrationRequestRecord } from '@/lib/conversational-bridge/types';

export interface ProposalActionResult {
  request?: OrchestrationRequestRecord;
  error?: string;
}

const idSchema = z.string().uuid();
const feedbackSchema = z.string().trim().min(3, 'Tell Mission Control what should change.').max(2000, 'Feedback is too long.');

function revalidateOrchestrationViews() {
  revalidatePath('/chat');
  revalidatePath('/projects');
  revalidatePath('/memory');
}

export async function approveProposalAction(id: string, externalToolsApproved = false): Promise<ProposalActionResult> {
  await requireAdminSession();
  const parsedId = idSchema.safeParse(id);
  if (!parsedId.success) return { error: 'Invalid proposal id.' };

  try {
    const request = await approveConversationProposal(parsedId.data, { externalToolsApproved });
    revalidateOrchestrationViews();
    return { request };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Unable to approve the proposal.' };
  }
}

export async function reviseProposalAction(id: string, feedback: string): Promise<ProposalActionResult> {
  await requireAdminSession();
  const parsedId = idSchema.safeParse(id);
  const parsedFeedback = feedbackSchema.safeParse(feedback);
  if (!parsedId.success) return { error: 'Invalid proposal id.' };
  if (!parsedFeedback.success) return { error: parsedFeedback.error.issues[0]?.message ?? 'Invalid feedback.' };

  try {
    const request = await reviseConversationProposal(parsedId.data, parsedFeedback.data);
    revalidateOrchestrationViews();
    return { request };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Unable to revise the proposal.' };
  }
}
