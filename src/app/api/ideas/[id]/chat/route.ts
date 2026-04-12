import { requireAdminSession } from '@/lib/auth/session';
import { getIdea, appendConversation } from '@/lib/ideas';
import { generateChatCompletion } from '@/lib/ai/moonshot';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try { await requireAdminSession(); } catch { return Response.json({ error: 'Unauthorized' }, { status: 401 }); }

  const { id } = await params;
  const { message } = await request.json();
  if (!message) return Response.json({ error: 'Message required' }, { status: 400 });

  const idea = await getIdea(id);
  if (!idea) return Response.json({ error: 'Idea not found' }, { status: 404 });

  // Save user message
  await appendConversation(id, { role: 'user', content: message, timestamp: new Date().toISOString() });

  try {
    // Build conversation context
    const history = idea.conversationHistory.slice(-10).map(m => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }));

    const systemPrompt = `You are a startup research assistant helping refine the idea "${idea.title}".
${idea.description ? `Description: ${idea.description}` : ''}
${idea.researchData ? `Research has been completed. Help the user refine their idea based on the research.` : `Help the user clarify their idea by asking targeted questions about target audience, timeline, budget, and similar tools.`}
Be concise and practical.`;

    const aiResponse = await generateChatCompletion(
      [
        { role: 'system', content: systemPrompt },
        ...history,
        { role: 'user', content: message },
      ],
      { model: 'kimi-k2.5', maxTokens: 2000 },
    );

    await appendConversation(id, { role: 'assistant', content: aiResponse, timestamp: new Date().toISOString() });

    return Response.json({ reply: aiResponse });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : 'Chat failed' }, { status: 500 });
  }
}
