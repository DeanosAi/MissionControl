export interface AiTeamMember {
  id: string;
  name: string;
  label: string;
  role: string;
  capability: string;
}

export const aiTeamMembers: AiTeamMember[] = [
  {
    id: 'automatic',
    name: 'Automatic',
    label: 'Automatic / Best fit',
    role: 'Mission Control selects the capability and provider by value',
    capability: 'reasoning',
  },
  {
    id: 'planning',
    name: 'Planning',
    label: 'Planning capability',
    role: 'Product planning, sequencing, and architecture',
    capability: 'planning',
  },
  {
    id: 'research',
    name: 'Research',
    label: 'Research capability',
    role: 'Evidence gathering and technology evaluation',
    capability: 'research',
  },
  {
    id: 'coding',
    name: 'Coding',
    label: 'Coding capability',
    role: 'Implementation work initiated through an approved task',
    capability: 'coding',
  },
  {
    id: 'quality',
    name: 'Quality',
    label: 'Testing / QA capability',
    role: 'Testing, security, and review',
    capability: 'testing',
  },
];
