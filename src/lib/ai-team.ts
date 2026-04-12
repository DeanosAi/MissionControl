export interface AiTeamMember {
  id: string;
  name: string;
  label: string;
  role: string;
  defaultModel: string;
}

export const aiTeamMembers: AiTeamMember[] = [
  {
    id: 'gpt-5-4',
    name: 'GPT-5.4',
    label: 'GPT-5.4 / Codex',
    role: 'Primary implementation and execution lane',
    defaultModel: 'GPT-5.4',
  },
  {
    id: 'sonnet',
    name: 'Sonnet',
    label: 'Claude Sonnet 4.5',
    role: 'Management, review, and task-keeping lane',
    defaultModel: 'Sonnet',
  },
  {
    id: 'opus',
    name: 'Opus',
    label: 'Claude Opus 4.6',
    role: 'Deep strategy and high-complexity reasoning',
    defaultModel: 'Opus',
  },
  {
    id: 'kimi',
    name: 'Kimi',
    label: 'Kimi K2.5',
    role: 'Fallback / overflow assistance',
    defaultModel: 'Kimi',
  },
  {
    id: 'scot',
    name: 'Scot',
    label: 'Scot',
    role: 'Mission Control overseer and primary assistant',
    defaultModel: 'GPT-5.4',
  },
];
