import 'server-only';

import { listAutomations } from '@/lib/automations';
import type { OrchestrationRequestRecord } from '@/lib/conversational-bridge/types';
import { listDomainMemory } from '@/lib/memory-domains/repository';
import { listProjects } from '@/lib/projects';
import { listResearchReports } from '@/lib/research-engine/repository';
import { listTasks } from '@/lib/tasks';

export interface ConversationWorkspaceContext {
  currentProject: {
    id: string;
    title: string;
    status: string;
    summary: string;
  } | null;
  relatedProjects: Array<{
    id: string;
    title: string;
    status: string;
    relationship: string;
  }>;
  relevantMemories: Array<{
    id: string;
    domain: string;
    title: string;
    summary: string;
    archived: boolean;
  }>;
  recentDecisions: Array<{
    id: string;
    title: string;
    summary: string;
  }>;
  researchFindings: Array<{
    id: string;
    title: string;
    technology: string;
    recommendation: string;
    whyItMatters: string;
    createdAt: string;
  }>;
  openTasks: Array<{
    id: string;
    title: string;
    status: string;
    priority: string;
  }>;
  runningAutomations: Array<{
    id: string;
    title: string;
    capability: string;
    nextRun: string | null;
  }>;
  recentlyLearned: Array<{
    id: string;
    title: string;
    summary: string;
    domain: string;
  }>;
  weeklyResearchStatus: {
    label: string;
    latestAt: string | null;
  };
}

function activeRequest(requests: OrchestrationRequestRecord[]) {
  return requests.find((request) => (
    request.status === 'proposal-ready'
    || request.status === 'cost-approval-required'
    || request.status === 'changes-requested'
    || request.status === 'planning'
  )) ?? requests[0] ?? null;
}

export async function getConversationWorkspaceContext(
  requests: OrchestrationRequestRecord[],
): Promise<ConversationWorkspaceContext> {
  const selectedRequest = activeRequest(requests);
  const projectId = selectedRequest?.projectId ?? null;

  const [projects, tasks, memories, reports, automations] = await Promise.all([
    listProjects().catch(() => []),
    listTasks().catch(() => []),
    listDomainMemory({
      projectId,
      includeArchived: true,
      limit: 30,
    }).catch(() => []),
    listResearchReports(8).catch(() => []),
    listAutomations().catch(() => []),
  ]);

  const currentProject = projectId
    ? projects.find((project) => project.id === projectId) ?? null
    : projects.find((project) => ['active', 'planning', 'proposal'].includes(project.status)) ?? null;
  const contextProjectId = currentProject?.id ?? null;
  const relatedProjects = currentProject
    ? projects
      .filter((project) => (
        project.id !== currentProject.id
        && (
          project.parentProjectId === currentProject.id
          || currentProject.parentProjectId === project.id
          || (
            currentProject.parentProjectId
            && project.parentProjectId === currentProject.parentProjectId
          )
        )
      ))
      .slice(0, 5)
      .map((project) => ({
        id: project.id,
        title: project.title,
        status: project.status,
        relationship: project.parentProjectId === currentProject.id
          ? 'Child project'
          : currentProject.parentProjectId === project.id
            ? 'Parent project'
            : 'Related project',
      }))
    : [];

  const decisionMemories = memories.filter((memory) => memory.domain === 'decision');
  const latestResearchAt = reports[0]?.createdAt ?? null;
  const researchIsCurrent = latestResearchAt
    ? Date.now() - new Date(latestResearchAt).getTime() < 8 * 24 * 60 * 60 * 1000
    : false;

  return {
    currentProject: currentProject ? {
      id: currentProject.id,
      title: currentProject.title,
      status: currentProject.status,
      summary: currentProject.summary,
    } : null,
    relatedProjects,
    relevantMemories: memories.slice(0, 8).map((memory) => ({
      id: memory.id,
      domain: memory.domain,
      title: memory.title,
      summary: memory.summary ?? memory.content.slice(0, 180),
      archived: memory.lifecycleState === 'archived',
    })),
    recentDecisions: decisionMemories.slice(0, 5).map((memory) => ({
      id: memory.id,
      title: memory.title,
      summary: memory.summary ?? memory.content.slice(0, 180),
    })),
    researchFindings: reports.slice(0, 5).map((report) => ({
      id: report.id,
      title: report.title,
      technology: report.technology,
      recommendation: report.recommendation,
      whyItMatters: report.whyItMatters,
      createdAt: report.createdAt,
    })),
    openTasks: tasks
      .filter((task) => task.status !== 'done' && task.status !== 'archived')
      .filter((task) => !contextProjectId || !task.projectId || task.projectId === contextProjectId)
      .slice(0, 6)
      .map((task) => ({
        id: task.id,
        title: task.title,
        status: task.status,
        priority: task.priority,
      })),
    runningAutomations: automations
      .filter((automation) => automation.status === 'active')
      .slice(0, 5)
      .map((automation) => ({
        id: automation.id,
        title: automation.title,
        capability: automation.capability,
        nextRun: automation.nextRun,
      })),
    recentlyLearned: memories.slice(0, 5).map((memory) => ({
      id: memory.id,
      title: memory.title,
      summary: memory.summary ?? memory.content.slice(0, 150),
      domain: memory.domain,
    })),
    weeklyResearchStatus: {
      label: latestResearchAt
        ? researchIsCurrent ? 'Current' : 'Review due'
        : 'Not run yet',
      latestAt: latestResearchAt,
    },
  };
}
