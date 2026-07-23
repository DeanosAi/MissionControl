import { DashboardShell } from '@/components/dashboard-shell';
import { listJournalEntries } from '@/lib/journal';
import { listMemoryNotes } from '@/lib/memory';
import { getMemoryDomainStats } from '@/lib/memory-domains/repository';
import { seedJournalFromData } from '@/lib/journal-seed';
import { JournalPanel } from './journal-panel';
import { MemoryPanel } from './memory-panel';
import { MemoryDomainOverview } from './memory-domain-overview';

export default async function MemoryPage() {
  // Seed hardcoded journal entries into DB on first visit (Milestone F migration aid)
  await seedJournalFromData();

  const [journalEntries, memoryNotes, domainStats] = await Promise.all([
    listJournalEntries(50),
    listMemoryNotes(),
    getMemoryDomainStats(),
  ]);

  return (
    <DashboardShell
      active="memory"
      title="Memory and Journal"
      subtitle="Unified context backed by specialised user, project, decision, research, and operational memory. Archived knowledge remains transparently retrievable."
    >
      <MemoryDomainOverview stats={domainStats} />
      <JournalPanel initialEntries={journalEntries} />
      <MemoryPanel initialNotes={memoryNotes} />
    </DashboardShell>
  );
}
