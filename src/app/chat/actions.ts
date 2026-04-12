'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { generateChatCompletion as generateAnthropicCompletion } from '@/lib/ai/anthropic';
import { getModel } from '@/lib/ai/models';
import { generateChatCompletion as generateMoonshotCompletion } from '@/lib/ai/moonshot';
import { generateChatCompletion as generateOpenAICompletion } from '@/lib/ai/openai';
import { isGptAvailable } from '@/lib/ai/gpt-oauth-status';
import { requireAdminSession } from '@/lib/auth/session';
import { createChatMessage, listChatMessages, type ChatMessageRecord } from '@/lib/chat';
import { detectTaskIntent, executeTaskCommand, buildTaskContext } from '@/lib/chat-tasks';
import { detectMemoryIntent, executeMemoryCommand } from '@/lib/chat-memory';
import { getJournalContext } from '@/lib/journal';
import { getMemoryContext } from '@/lib/memory';

const chatSchema = z.object({
  message: z.string().min(1, 'Enter a message.').max(4000, 'Message too long.'),
  model: z.string().optional(),
});

export interface ChatFormState {
  error?: string;
  message?: ChatMessageRecord;
}

function buildSystemPrompt(
  modelName: string,
  provider: string,
  taskContext: string,
  journalContext: string,
  memoryContext: string,
) {
  return [
    `You are Scot, Mission Control's AI assistant. You help Dean with his work at Mingara (social media content & digital marketing).`,
    ``,
    `You are currently responding through the ${modelName} model from ${provider}. Your assistant identity is Scot. If asked what model is running, answer with the current model and provider exactly. Never say you are Kimi unless the current model is Kimi K2.5. Never say you are Claude unless the current model is Claude Opus 4.6 or Claude Sonnet 4.5. Do not claim to be a different model/provider than the one named above.`,
    ``,
    `Be helpful, direct, and practical. You have access to Mission Control, a builder OS for ideas, projects, AI builds, systems, automations, and memory.`,
    ``,
    `You can help manage tasks, journal, and memory. Users can say:`,
    `- "create task: <title>" to add a task`,
    `- "list tasks" to see all current tasks`,
    `- "run task <name>" to execute a task with its assigned AI`,
    `- "move task <name> to <status>" to change status`,
    `- "show task <name>" to see task details`,
    `- "add journal: <title>" to add a journal entry`,
    `- "show journal" to see recent entries`,
    `- "remember <key> = <value>" to save a memory note`,
    `- "show memory" to see saved notes`,
    `- "forget <key>" to remove a note`,
    ``,
    `When users discuss tasks or project history, reference the context below.`,
    ``,
    taskContext,
    ``,
    journalContext,
    ``,
    memoryContext,
    ``,
    `Keep responses concise and actionable.`,
  ].join('\n');
}

async function callModel(
  modelId: string,
  provider: string,
  messages: { role: 'system' | 'user' | 'assistant'; content: string }[],
): Promise<string> {
  const timeoutMs = 120000;
  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error(`Request timed out after ${timeoutMs / 1000}s. The model may be temporarily slow or unavailable.`)), timeoutMs),
  );

  if (provider === 'openai') {
    return Promise.race([generateOpenAICompletion(messages, { model: modelId }), timeoutPromise]);
  } else if (provider === 'anthropic') {
    return Promise.race([generateAnthropicCompletion(messages, { model: modelId }), timeoutPromise]);
  } else if (provider === 'moonshot') {
    return Promise.race([generateMoonshotCompletion(messages, { model: modelId }), timeoutPromise]);
  } else {
    throw new Error(`Unsupported provider: ${provider}`);
  }
}

export async function sendChatMessageAction(_prev: ChatFormState, formData: FormData): Promise<ChatFormState> {
  await requireAdminSession();

  const parsed = chatSchema.safeParse({
    message: formData.get('message'),
    model: formData.get('model'),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Unable to send message.' };
  }

  const selectedModelId = parsed.data.model || 'gpt-5.4';
  let modelInfo = getModel(selectedModelId);

  if (!modelInfo) {
    return { error: 'Invalid model selected.' };
  }

  // GPT OAuth fallback: if GPT is selected but OAuth proxy is down, fall back
  let fellBack = false;
  let originalModelName = '';
  if (modelInfo.requiresOAuth) {
    const gptUp = await isGptAvailable();
    if (!gptUp && modelInfo.fallbackModelId) {
      originalModelName = modelInfo.name;
      const fallback = getModel(modelInfo.fallbackModelId);
      if (fallback) {
        modelInfo = fallback;
        fellBack = true;
      }
    }
  }

  const userMessage = parsed.data.message;

  // Save user message
  await createChatMessage('user', userMessage);

  // -- Check for task commands (Milestone E) --
  const taskCommand = detectTaskIntent(userMessage);
  if (taskCommand) {
    try {
      const result = await executeTaskCommand(taskCommand);
      const assistantMessage = await createChatMessage('assistant', `[${modelInfo.name}] ${result.response}`);
      if (result.mutated) {
        revalidatePath('/projects/current-tasks');
        revalidatePath('/projects');
        revalidatePath('/memory');
      }
      revalidatePath('/chat');
      return { message: assistantMessage };
    } catch (err) {
      console.error('Task command error:', err);
      const msg = err instanceof Error ? err.message : 'Task command failed';
      const fb = await createChatMessage('assistant', `[${modelInfo.name}] Sorry, the task command failed: ${msg}`);
      revalidatePath('/chat');
      return { message: fb };
    }
  }

  // -- Check for memory/journal commands (Milestone F) --
  const memoryCommand = detectMemoryIntent(userMessage);
  if (memoryCommand) {
    try {
      const result = await executeMemoryCommand(memoryCommand);
      const assistantMessage = await createChatMessage('assistant', `[${modelInfo.name}] ${result.response}`);
      if (result.mutated) {
        revalidatePath('/memory');
      }
      revalidatePath('/chat');
      return { message: assistantMessage };
    } catch (err) {
      console.error('Memory command error:', err);
      const msg = err instanceof Error ? err.message : 'Memory command failed';
      const fb = await createChatMessage('assistant', `[${modelInfo.name}] Sorry, the memory command failed: ${msg}`);
      revalidatePath('/chat');
      return { message: fb };
    }
  }

  // -- Normal chat flow with full context --
  try {
    const recentMessages = await listChatMessages();

    const conversationHistory = recentMessages
      .filter((msg) => msg.role !== 'system')
      .slice(-10)
      .map((msg) => ({
        role: msg.role as 'user' | 'assistant' | 'system',
        content: msg.role === 'assistant'
          ? msg.content
              .replace(/^\[[^\]]+\]\s*/, '')
              .replace(/\b(Kimi K2\.5 from Moonshot AI|Claude Sonnet 4\.5 from Anthropic|Claude Opus 4\.6 from Anthropic)\b/gi, 'the currently selected model')
          : msg.content,
      }));

    const providerLabel = modelInfo.provider === 'openai' ? 'OpenAI' : modelInfo.provider === 'anthropic' ? 'Anthropic' : 'Moonshot';

    // Build full context: tasks + journal + memory (Milestone F)
    const [taskContext, journalContext, memoryContext] = await Promise.all([
      buildTaskContext(),
      getJournalContext(),
      getMemoryContext(),
    ]);

    const systemPrompt = buildSystemPrompt(modelInfo.name, providerLabel, taskContext, journalContext, memoryContext);

    const aiResponse = await callModel(modelInfo.id, modelInfo.provider, [
      { role: 'system', content: systemPrompt },
      ...conversationHistory,
    ]);

    const fallbackNote = fellBack ? ` _(${originalModelName} unavailable — host PC offline, using ${modelInfo.name})_` : '';
    const assistantMessage = await createChatMessage('assistant', `[${modelInfo.name}] ${aiResponse}${fallbackNote}`);
    revalidatePath('/chat');
    return { message: assistantMessage };
  } catch (error) {
    console.error('Chat error:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    let hint = '';
    if (errorMessage.includes('timed out')) {
      hint = `\n\nTry sending your message again.`;
    } else if (errorMessage.includes('API key')) {
      hint = `\n\nThe ${modelInfo.provider.toUpperCase()} API key may be missing or invalid.`;
    } else if (errorMessage.includes('401') || errorMessage.includes('403')) {
      hint = `\n\nAuthentication failed for ${modelInfo.name}.`;
    } else if (errorMessage.includes('429')) {
      hint = `\n\nRate limit reached for ${modelInfo.name}. Wait a moment.`;
    }

    const fallbackMessage = await createChatMessage(
      'assistant',
      `[${modelInfo.name}] Sorry, I encountered an error: ${errorMessage}${hint}`,
    );
    revalidatePath('/chat');
    return { message: fallbackMessage };
  }
}
