import { requireAdminSession } from '@/lib/auth/session';
import { getIdea, updateIdeaStatus } from '@/lib/ideas';
import { createTask } from '@/lib/tasks';
import { createJournalEntry } from '@/lib/journal';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try { await requireAdminSession(); } catch { return Response.json({ error: 'Unauthorized' }, { status: 401 }); }

  const { id } = await params;

  let model: string;
  try {
    const body = await request.json();
    model = body.model;
  } catch {
    return Response.json({ error: 'Invalid request body' }, { status: 400 });
  }

  if (!model) return Response.json({ error: 'Model is required' }, { status: 400 });

  const idea = await getIdea(id);
  if (!idea) return Response.json({ error: 'Idea not found' }, { status: 404 });

  try {
    // Build a comprehensive task description from the research data
    const research = idea.researchData;
    let description = `## Build: ${idea.title}\n\n`;

    if (idea.description) {
      description += `### Concept\n${idea.description}\n\n`;
    }

    if (research) {
      if (research.market) {
        description += `### Market Analysis (Viability: ${research.market.viability})\n${research.market.summary}\n`;
        if (research.market.notes) description += `${research.market.notes}\n`;
        description += '\n';
      }
      if (research.technical) {
        description += `### Technical Approach (Complexity: ${research.technical.complexity})\n${research.technical.feasibility}\nRecommended Stack: ${research.technical.stack}\n\n`;
      }
      if (research.competition) {
        if (research.competition.competitors?.length > 0) {
          description += `### Competition\nCompetitors: ${research.competition.competitors.join(', ')}\n`;
        }
        description += `Differentiation: ${research.competition.differentiation}\n\n`;
      }
      if (research.estimate) {
        description += `### Estimates\n- Cost: ${research.estimate.cost}\n- Timeline: ${research.estimate.time}\n- Resources: ${research.estimate.resources}\n\n`;
      }
    }

    description += `### Instructions\nBuild a working MVP for this idea based on the research above. Include all core functionality, a clean UI, and clear documentation. Deliver production-ready code.`;

    // Create the task
    const task = await createTask({
      title: `Build: ${idea.title}`,
      description,
      status: 'backlog',
      priority: 'high',
      assignedAi: model,
      notes: `Created from Ideas page. Idea ID: ${idea.id}. Full research report and conversation history available in the Ideas section.`,
    });

    // Update idea status
    await updateIdeaStatus(id, 'building');

    // Journal it
    try {
      await createJournalEntry({
        title: `Idea sent to build: ${idea.title}`,
        detail: `Created task "Build: ${idea.title}" assigned to ${model}. Task is in the To Do column ready to run.`,
        entryType: 'auto',
        source: 'ideas',
      });
    } catch { /* non-critical */ }

    return Response.json({
      success: true,
      taskId: task.id,
      taskTitle: task.title,
      assignedAi: model,
    });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : 'Failed to create task' }, { status: 500 });
  }
}
