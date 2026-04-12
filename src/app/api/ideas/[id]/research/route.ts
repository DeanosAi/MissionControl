import { requireAdminSession } from '@/lib/auth/session';
import { getIdea, updateIdeaStatus, appendConversation, saveResearchData, type IdeaResearchData } from '@/lib/ideas';
import { generateChatCompletion } from '@/lib/ai/moonshot';

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try { await requireAdminSession(); } catch { return Response.json({ error: 'Unauthorized' }, { status: 401 }); }

  const { id } = await params;
  const idea = await getIdea(id);
  if (!idea) return Response.json({ error: 'Idea not found' }, { status: 404 });

  try {
    await updateIdeaStatus(id, 'researching');

    const researchPrompt = `You are a startup research analyst. Thoroughly research this idea and provide a structured report.

## Idea: ${idea.title}
${idea.description ? `## Description: ${idea.description}` : ''}

Provide your research in this exact JSON format (respond ONLY with JSON, no markdown):
{
  "market": { "summary": "market overview", "viability": "high|medium|low", "notes": "key insights" },
  "technical": { "feasibility": "assessment", "stack": "recommended tech stack", "complexity": "low|medium|high" },
  "competition": { "competitors": ["competitor1", "competitor2"], "differentiation": "what makes this unique" },
  "estimate": { "cost": "estimated cost range", "time": "estimated timeline", "resources": "what's needed" }
}`;

    const result = await generateChatCompletion(
      [
        { role: 'system', content: 'You are a thorough startup research analyst. Respond ONLY with valid JSON, no other text.' },
        { role: 'user', content: researchPrompt },
      ],
      { model: 'kimi-k2.5', maxTokens: 4000 },
    );

    // Parse the research data
    let researchData: IdeaResearchData;
    try {
      const cleaned = result.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
      researchData = JSON.parse(cleaned);
    } catch {
      // If JSON parsing fails, store as raw text in market summary
      researchData = {
        market: { summary: result, viability: 'unknown', notes: 'Raw research output (JSON parse failed)' },
        technical: { feasibility: 'See market summary', stack: 'TBD', complexity: 'medium' },
        competition: { competitors: [], differentiation: 'See market summary' },
        estimate: { cost: 'TBD', time: 'TBD', resources: 'TBD' },
      };
    }

    await saveResearchData(id, researchData);

    await appendConversation(id, {
      role: 'assistant',
      content: `Research complete for "${idea.title}". Report covers market viability, technical feasibility, competition, and cost/time estimates.`,
      timestamp: new Date().toISOString(),
    });

    return Response.json({ success: true, researchData });
  } catch (err) {
    await updateIdeaStatus(id, 'submitted'); // rollback status
    return Response.json({ error: err instanceof Error ? err.message : 'Research failed' }, { status: 500 });
  }
}
