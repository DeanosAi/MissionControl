import { DashboardShell } from '@/components/dashboard-shell';
import { listJournalEntries } from '@/lib/journal';
import { listMemoryNotes } from '@/lib/memory';
import { seedJournalFromData } from '@/lib/journal-seed';
import { JournalPanel } from './journal-panel';
import { MemoryPanel } from './memory-panel';

export default async function MemoryPage() {
  // Seed hardcoded journal entries into DB on first visit (Milestone F migration aid)
  await seedJournalFromData();

  const [journalEntries, memoryNotes] = await Promise.all([
    listJournalEntries(50),
    listMemoryNotes(),
  ]);

  return (
    <DashboardShell
      active="memory"
      title="Memory and Journal"
      subtitle="Project history, decisions, and curated AI-readable context. All entries are stored in the database and injected into every AI conversation."
    >
      <JournalPanel initialEntries={journalEntries} />
      <MemoryPanel initialNotes={memoryNotes} />
    </DashboardShell>
  );
}
