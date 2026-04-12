import 'server-only';

import { getLatestUsageSnapshot } from '@/lib/usage-snapshot';

export interface UsageSnapshot {
  openai: {
    windowLeft: string;
    resetIn: string;
    weeklyLeft: string;
    weeklyResetIn: string;
    source: string;
  };
  claude: {
    status: string;
    note: string;
    source: string;
  };
}

const fallbackSnapshot: UsageSnapshot = {
  openai: {
    windowLeft: 'Unavailable',
    resetIn: 'Unknown',
    weeklyLeft: 'Unavailable',
    weeklyResetIn: 'Unknown',
    source: 'fallback',
  },
  claude: {
    status: 'Provider status unavailable',
    note: 'No host-side usage snapshot has been recorded yet.',
    source: 'fallback',
  },
};

export async function getUsageSnapshot(): Promise<UsageSnapshot> {
  const snapshot = await getLatestUsageSnapshot();
  if (!snapshot) {
    return fallbackSnapshot;
  }

  return {
    openai: {
      windowLeft: snapshot.openai_window_left,
      resetIn: snapshot.openai_reset_in,
      weeklyLeft: snapshot.openai_weekly_left,
      weeklyResetIn: snapshot.openai_weekly_reset_in,
      source: `${snapshot.source} @ ${snapshot.updated_at}`,
    },
    claude: {
      status: snapshot.claude_status,
      note: snapshot.claude_note,
      source: `${snapshot.source} @ ${snapshot.updated_at}`,
    },
  };
}
