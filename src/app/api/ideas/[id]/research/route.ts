import { requireAdminSession } from '@/lib/auth/session';
import { getIdea, updateIdeaStatus, appendConversation, saveResearchData, type IdeaResearchData } from '@/lib/ideas';
import { completeWithCapability } from '@/lib/conversational-bridge/model-router';

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

    const researchPrompt = `Analyze this startup/product idea and provide a structured research report.

IDEA: ${idea.title}
${idea.description ? `DESCRIPTION: ${idea.description}` : ''}

You MUST respond with ONLY a JSON object. No text before it. No text after it. No markdown code fences. Just raw JSON.

The JSON must have exactly this structure:
{"market":{"summary":"2-3 sentences about market demand and target users","viability":"high","notes":"key market insights"},"technical":{"feasibility":"2-3 sentences about how to build this","stack":"recommended technologies","complexity":"medium"},"competition":{"competitors":["Competitor A","Competitor B"],"differentiation":"what makes this idea unique"},"estimate":{"cost":"dollar range estimate","time":"timeline estimate","resources":"what is needed to build"}}

Use "high", "medium", or "low" for viability and complexity. Fill every field with real analysis.`;

    const completion = await completeWithCapability(
      'research',
      () => [
        { role: 'system', content: 'You are a startup analyst. Respond with ONLY a raw JSON object. No markdown. No explanation. No code fences. Just the JSON.' },
        { role: 'user', content: researchPrompt },
      ],
      4000,
    );
    const result = completion.content;

    // Extract and parse JSON from the response
    const researchData = extractAndValidateResearch(result);

    await saveResearchData(id, researchData);

    await appendConversation(id, {
      role: 'assistant',
      content: `Research complete for "${idea.title}". Expand the Research Report to see the full analysis.`,
      timestamp: new Date().toISOString(),
    });

    const updated = await getIdea(id);
    return Response.json(updated);
  } catch (err) {
    console.error('Research error:', err);
    await updateIdeaStatus(id, 'submitted');
    return Response.json({ error: err instanceof Error ? err.message : 'Research failed' }, { status: 500 });
  }
}

/**
 * Extracts a valid research JSON object from the AI response.
 * Handles: raw JSON, markdown-fenced JSON, JSON embedded in text,
 * and double-encoded strings.
 */
function extractAndValidateResearch(raw: string): IdeaResearchData {
  const attempts: (() => IdeaResearchData)[] = [
    // 1. Direct parse
    () => JSON.parse(raw.trim()),

    // 2. Strip markdown fences
    () => JSON.parse(raw.replace(/^```(?:json)?\s*/gm, '').replace(/```\s*$/gm, '').trim()),

    // 3. Extract first { ... } block
    () => {
      const start = raw.indexOf('{');
      const end = raw.lastIndexOf('}');
      if (start === -1 || end <= start) throw new Error('no braces');
      return JSON.parse(raw.substring(start, end + 1));
    },

    // 4. Handle double-encoded: the whole thing might be a JSON string containing JSON
    () => {
      const unescaped = raw.replace(/\\"/g, '"').replace(/\\n/g, '\n');
      const start = unescaped.indexOf('{');
      const end = unescaped.lastIndexOf('}');
      if (start === -1 || end <= start) throw new Error('no braces');
      return JSON.parse(unescaped.substring(start, end + 1));
    },
  ];

  for (const attempt of attempts) {
    try {
      const parsed = attempt();
      // Validate it has at least one expected section
      if (parsed && typeof parsed === 'object' && (parsed.market || parsed.technical || parsed.competition || parsed.estimate)) {
        return parsed;
      }
    } catch { /* try next */ }
  }

  // Fallback: build structured data from the raw text
  const cleanText = raw.replace(/[{}"\\]/g, ' ').replace(/\s+/g, ' ').trim();
  return {
    market: { summary: cleanText.substring(0, 400), viability: 'unknown', notes: '' },
    technical: { feasibility: 'See market summary for full analysis.', stack: 'To be determined', complexity: 'medium' },
    competition: { competitors: [], differentiation: 'See market summary.' },
    estimate: { cost: 'To be determined', time: 'To be determined', resources: 'To be determined' },
  };
}
