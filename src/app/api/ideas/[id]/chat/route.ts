import { requireAdminSession } from '@/lib/auth/session';
import { getIdea, appendConversation } from '@/lib/ideas';
import { completeWithCapability } from '@/lib/conversational-bridge/model-router';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try { await requireAdminSession(); } catch { return Response.json({ error: 'Unauthorized' }, { status: 401 }); }

  let id: string;
  try {
    const p = await params;
    id = p.id;
  } catch {
    return Response.json({ error: 'Invalid request' }, { status: 400 });
  }

  let message: string;
  try {
    const body = await request.json();
    message = body.message;
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!message || typeof message !== 'string' || !message.trim()) {
    return Response.json({ error: 'Message required' }, { status: 400 });
  }

  try {
    const idea = await getIdea(id);
    if (!idea) return Response.json({ error: 'Idea not found' }, { status: 404 });

    // Save user message to DB
    await appendConversation(id, { role: 'user', content: message.trim(), timestamp: new Date().toISOString() });

    // Build conversation for the AI.
    // Use the history from BEFORE we appended the new user message,
    // then add the new user message explicitly at the end.
    const rawHistory = Array.isArray(idea.conversationHistory) ? idea.conversationHistory : [];

    // Filter out messages with empty or unsupported roles before provider routing.
    const validHistory = rawHistory
      .filter(m =>
        m &&
        typeof m.role === 'string' && m.role.trim() !== '' &&
        typeof m.content === 'string' && m.content.trim() !== '' &&
        (m.role === 'user' || m.role === 'assistant')
      )
      .slice(-8);

    // Collapse consecutive same-role messages for broad provider compatibility.
    const cleanHistory: { role: 'user' | 'assistant'; content: string }[] = [];
    for (const m of validHistory) {
      const role = m.role as 'user' | 'assistant';
      const content = m.content.trim();
      if (cleanHistory.length > 0 && cleanHistory[cleanHistory.length - 1].role === role) {
        cleanHistory[cleanHistory.length - 1].content += '\n' + content;
      } else {
        cleanHistory.push({ role, content });
      }
    }

    const systemPrompt = `You are Scot, a helpful startup research assistant inside Mission Control. You are helping Dean refine the idea "${idea.title}".
${idea.description ? `The idea: ${idea.description}` : ''}
${idea.researchData ? 'Research has been completed for this idea. Help the user refine, expand, or act on the research findings.' : 'Help the user clarify and develop their idea. Ask about target audience, goals, timeline, budget, and similar products they have seen.'}
Be concise, practical, and conversational. Do not use JSON. Respond in plain readable text.`;

    const completion = await completeWithCapability(
      'conversation',
      () => [
        { role: 'system', content: systemPrompt },
        ...cleanHistory,
        { role: 'user', content: message.trim() },
      ],
      2000,
    );
    const aiResponse = completion.content;

    // Save assistant response to DB
    await appendConversation(id, { role: 'assistant', content: aiResponse, timestamp: new Date().toISOString() });

    return Response.json({ reply: aiResponse });
  } catch (err) {
    console.error('Ideas chat error:', err);
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    return Response.json({ error: `Chat failed: ${errorMessage}` }, { status: 500 });
  }
}
