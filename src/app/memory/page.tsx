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
      <div className="mb-6 flex gap-3">
        <a 
          href="#journal" 
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
        >
          Jump to Journal
        </a>
        <a 
          href="#memory" 
          className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 transition"
        >
          Jump to Memory
        </a>
      </div>
      <div id="journal">
        <JournalPanel initialEntries={journalEntries} />
      </div>
      <div id="memory" className="mt-8">
        <MemoryPanel initialNotes={memoryNotes} />
      </div>
    </DashboardShell>
  );
}
