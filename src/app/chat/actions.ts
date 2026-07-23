'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { requireAdminSession } from '@/lib/auth/session';
import {
  createChatMessage,
  linkChatMessageToOrchestration,
  listChatMessages,
  type ChatMessageRecord,
} from '@/lib/chat';
import { detectMemoryIntent, executeMemoryCommand } from '@/lib/chat-memory';
import { buildTaskContext, detectTaskIntent, executeTaskCommand } from '@/lib/chat-tasks';
import { isConversationalBuildRequest } from '@/lib/conversational-bridge/intent';
import { completeWithCapability } from '@/lib/conversational-bridge/model-router';
import { createProposalFromConversation } from '@/lib/conversational-bridge/service';
import type { OrchestrationRequestRecord } from '@/lib/conversational-bridge/types';
import {
  linkDecisionIntakeToOrchestration,
  recordDecisionIntake,
} from '@/lib/decision-engine/intake';
import { getJournalContext } from '@/lib/journal';
import { getMemoryContext } from '@/lib/memory';

const chatSchema = z.object({
  message: z.string().min(1, 'Enter a message.').max(4000, 'Message too long.'),
});

export interface ChatFormState {
  error?: string;
  message?: ChatMessageRecord;
  orchestration?: OrchestrationRequestRecord;
}

function buildSystemPrompt(
  modelName: string,
  provider: string,
  taskContext: string,
  journalContext: string,
  memoryContext: string,
) {
  return [
    `You are Scot, Mission Control's conversational AI operating system. Every request enters the Decision Engine, and you help Dean turn outcomes into researched, compared, approval-first work.`,
    '',
    `This response is being produced by ${modelName} from ${provider}. Your assistant identity is Scot. If asked which model is running, answer with that model and provider exactly.`,
    '',
    'Be helpful, direct, practical, and concise. Mission Control has projects, ideas, tasks, AI builds, systems, automations, journal, and memory.',
    'For a new product or significant change, explain that Mission Control compares multiple approaches, recommends one, prepares a proposal and UI preview, and waits for approval. Never claim a build has started unless the stored orchestration state says it has moved beyond approval.',
    '',
    'Existing operational commands include:',
    '- "create task: <title>" to add a manual task',
    '- "list tasks" to see current tasks',
    '- "run task <name>" to manually execute an existing approved task',
    '- "move task <name> to <status>" to change status',
    '- "show task <name>" to see task details',
    '- "add journal: <title>" to add a journal entry',
    '- "show journal" to see recent entries',
    '- "remember <key> = <value>" to save a memory note',
    '- "show memory" to see saved notes',
    '- "forget <key>" to remove a note',
    '',
    'When discussing work or project history, use the context below.',
    '',
    taskContext,
    '',
    journalContext,
    '',
    memoryContext,
  ].join('\n');
}

export async function sendChatMessageAction(_prev: ChatFormState, formData: FormData): Promise<ChatFormState> {
  await requireAdminSession();

  const parsed = chatSchema.safeParse({ message: formData.get('message') });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Unable to send message.' };
  }

  const userMessage = parsed.data.message;
  const storedUserMessage = await createChatMessage('user', userMessage);

  // Preserve existing explicit task commands. They are user-directed operations,
  // not autonomous work initiated by the Conversational Bridge.
  const taskCommand = detectTaskIntent(userMessage);
  if (taskCommand) {
    try {
      await recordDecisionIntake({
        chatMessageId: storedUserMessage.id,
        message: userMessage,
        route: 'task-command',
        requiresApproval: false,
      });
      const result = await executeTaskCommand(taskCommand);
      const assistantMessage = await createChatMessage('assistant', `[Mission Control] ${result.response}`);
      if (result.mutated) {
        revalidatePath('/projects/current-tasks');
        revalidatePath('/projects');
        revalidatePath('/memory');
      }
      revalidatePath('/chat');
      return { message: assistantMessage };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Task command failed.';
      const assistantMessage = await createChatMessage('assistant', `[Mission Control] Sorry, the task command failed: ${message}`);
      revalidatePath('/chat');
      return { message: assistantMessage };
    }
  }

  const memoryCommand = detectMemoryIntent(userMessage);
  if (memoryCommand) {
    try {
      await recordDecisionIntake({
        chatMessageId: storedUserMessage.id,
        message: userMessage,
        route: 'memory-command',
        requiresApproval: false,
      });
      const result = await executeMemoryCommand(memoryCommand);
      const assistantMessage = await createChatMessage('assistant', `[Mission Control] ${result.response}`);
      if (result.mutated) revalidatePath('/memory');
      revalidatePath('/chat');
      return { message: assistantMessage };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Memory command failed.';
      const assistantMessage = await createChatMessage('assistant', `[Mission Control] Sorry, the memory command failed: ${message}`);
      revalidatePath('/chat');
      return { message: assistantMessage };
    }
  }

  // V3 Sprint 1: create a project, proposal, and UI preview, then stop.
  if (isConversationalBuildRequest(userMessage)) {
    try {
      await recordDecisionIntake({
        chatMessageId: storedUserMessage.id,
        message: userMessage,
        route: 'product-decision',
        requiresApproval: true,
      });
      const orchestration = await createProposalFromConversation(userMessage);
      await linkChatMessageToOrchestration(storedUserMessage.id, orchestration.projectId, orchestration.id);
      await linkDecisionIntakeToOrchestration(storedUserMessage.id, orchestration.id);
      const assistantMessage = await createChatMessage(
        'assistant',
        orchestration.status === 'cost-approval-required'
          ? `[Mission Control] I created ${orchestration.projectTitle} in Projects, then paused before paid analysis because the estimated planning cost needs your approval. Nothing has been spent or built.`
          : `[Mission Control] I created ${orchestration.projectTitle} in Projects. The Decision Engine compared multiple approaches, recommended one, and prepared a proposal with a UI preview. Review it below; nothing will be built until you approve it.`,
        { projectId: orchestration.projectId, orchestrationRequestId: orchestration.id },
      );
      revalidatePath('/chat');
      revalidatePath('/projects');
      revalidatePath('/memory');
      return { message: assistantMessage, orchestration };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Proposal generation failed.';
      const assistantMessage = await createChatMessage(
        'assistant',
        `[Mission Control] I saved your request, but I could not prepare the proposal: ${message}`,
      );
      revalidatePath('/chat');
      return { message: assistantMessage };
    }
  }

  try {
    await recordDecisionIntake({
      chatMessageId: storedUserMessage.id,
      message: userMessage,
      route: 'conversation',
      requiresApproval: false,
    });
    const recentMessages = await listChatMessages();
    const conversationHistory = recentMessages
      .filter((message) => message.role !== 'system')
      .slice(-10)
      .map((message) => ({
        role: message.role as 'user' | 'assistant',
        content: message.role === 'assistant'
          ? message.content.replace(/^\[[^\]]+\]\s*/, '')
          : message.content,
      }));

    const [taskContext, journalContext, memoryContext] = await Promise.all([
      buildTaskContext(),
      getJournalContext(),
      getMemoryContext(userMessage),
    ]);

    const completion = await completeWithCapability('conversation', (selection) => {
      const providerLabel = selection.provider === 'openai'
        ? 'OpenAI'
        : selection.provider === 'anthropic'
          ? 'Anthropic'
          : selection.provider === 'moonshot'
            ? 'Moonshot'
            : 'a local model';
      return [
        { role: 'system', content: buildSystemPrompt(selection.name, providerLabel, taskContext, journalContext, memoryContext) },
        ...conversationHistory,
      ];
    });

    const recoveryNote = completion.recoveredAttempts.length > 0
      ? ` _(Mission Control automatically recovered from ${completion.recoveredAttempts.length} unavailable model${completion.recoveredAttempts.length === 1 ? '' : 's'}.)_`
      : '';
    const assistantMessage = await createChatMessage(
      'assistant',
      `[${completion.selection.name}] ${completion.content}${recoveryNote}`,
    );
    revalidatePath('/chat');
    return { message: assistantMessage };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const assistantMessage = await createChatMessage(
      'assistant',
      `[Mission Control] Sorry, I could not complete that response: ${errorMessage}`,
    );
    revalidatePath('/chat');
    return { message: assistantMessage };
  }
}
