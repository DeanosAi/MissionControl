import 'server-only';

import { createJournalEntry, listJournalEntries, type JournalType } from '@/lib/journal';
import { listMemoryNotes, upsertMemoryNote, deleteMemoryNote, getMemoryByKey } from '@/lib/memory';

export type MemoryCommandType = 'add_journal' | 'show_journal' | 'remember' | 'show_memory' | 'forget';

export interface MemoryCommand {
  type: MemoryCommandType;
  title?: string;
  detail?: string;
  entryType?: string;
  key?: string;
  value?: string;
}

/** Detect journal/memory commands in user messages */
export function detectMemoryIntent(message: string): MemoryCommand | null {
  const lower = message.toLowerCase().trim();

  // -- ADD JOURNAL --
  const journalMatch = lower.match(/^(?:add|new|create|log)\s+(?:a\s+)?(?:journal|entry)[:\s]+(.+)/i);
  if (journalMatch) {
    return { type: 'add_journal', title: message.slice(message.toLowerCase().indexOf(journalMatch[1].substring(0, 10))).trim() };
  }

  // -- SHOW JOURNAL --
  if (/^(?:show|list|view|get)\s+(?:the\s+)?(?:journal|entries|log)/i.test(lower) || lower === 'journal' || lower === 'show journal') {
    return { type: 'show_journal' };
  }

  // -- REMEMBER --
  const rememberMatch = message.match(/^(?:remember|save|store|note)\s+(.+?)\s*=\s*(.+)/i);
  if (rememberMatch) {
    return { type: 'remember', key: rememberMatch[1].trim(), value: rememberMatch[2].trim() };
  }
  // Also: "remember that <content>" (key auto-generated)
  const rememberThatMatch = message.match(/^(?:remember|save|store|note)\s+(?:that\s+)?(.{5,})/i);
  if (rememberThatMatch && !rememberMatch) {
    const content = rememberThatMatch[1].trim();
    const key = content.substring(0, 40).replace(/[^a-zA-Z0-9\s-]/g, '').trim().replace(/\s+/g, '-').toLowerCase();
    return { type: 'remember', key, value: content };
  }

  // -- SHOW MEMORY --
  if (/^(?:show|list|view|get|what do you)\s+(?:the\s+)?(?:memory|memories|notes|remember)/i.test(lower) || lower === 'memory' || lower === 'show memory') {
    return { type: 'show_memory' };
  }

  // -- FORGET --
  const forgetMatch = lower.match(/^(?:forget|remove|delete)\s+(?:memory\s+)?(?:note\s+)?["""]?(.+?)["""]?\s*$/i);
  if (forgetMatch) {
    return { type: 'forget', key: forgetMatch[1].trim() };
  }

  return null;
}

export interface MemoryCommandResult {
  response: string;
  mutated: boolean;
}

/** Execute a memory/journal command */
export async function executeMemoryCommand(cmd: MemoryCommand): Promise<MemoryCommandResult> {
  switch (cmd.type) {
    case 'add_journal': {
      if (!cmd.title) return { response: 'I need a title for the journal entry. Try: "add journal: Your entry title"', mutated: false };
      const entry = await createJournalEntry({
        title: cmd.title,
        detail: cmd.detail || cmd.title,
        entryType: 'note',
        source: 'chat',
      });
      return {
        response: `**Journal entry added:**\n[${entry.entryType}] ${entry.title}\n${entry.detail}`,
        mutated: true,
      };
    }

    case 'show_journal': {
      const entries = await listJournalEntries(15);
      if (entries.length === 0) return { response: 'No journal entries yet. Add one with "add journal: title"', mutated: false };

      let out = `**Recent Journal** (${entries.length} entries)\n\n`;
      for (const e of entries) {
        const date = e.createdAt.split('T')[0];
        const typeIcon: Record<string, string> = { milestone: 'M', ops: 'O', decision: 'D', auto: 'A', note: 'N' };
        out += `- [${date}] [${typeIcon[e.entryType] || e.entryType}] **${e.title}**\n`;
      }
      return { response: out.trim(), mutated: false };
    }

    case 'remember': {
      if (!cmd.key || !cmd.value) return { response: 'I need a key and value. Try: "remember project-goal = Build Mission Control VPS"', mutated: false };
      const note = await upsertMemoryNote({
        key: cmd.key,
        content: cmd.value,
        category: 'context',
      });
      return {
        response: `**Remembered:** [${note.key}] = ${note.content}`,
        mutated: true,
      };
    }

    case 'show_memory': {
      const notes = await listMemoryNotes();
      if (notes.length === 0) return { response: 'No memory notes saved yet. Save one with "remember key = value"', mutated: false };

      let out = `**Memory Notes** (${notes.length})\n\n`;
      for (const n of notes) {
        const pin = n.pinned ? ' [pinned]' : '';
        out += `- **${n.key}**${pin}: ${n.content}\n`;
      }
      return { response: out.trim(), mutated: false };
    }

    case 'forget': {
      if (!cmd.key) return { response: 'Which memory note should I forget? Provide the key.', mutated: false };
      const note = await getMemoryByKey(cmd.key);
      if (!note) {
        // Try fuzzy match
        const all = await listMemoryNotes();
        const match = all.find(n => n.key.toLowerCase().includes(cmd.key!.toLowerCase()));
        if (match) {
          await deleteMemoryNote(match.id);
          return { response: `**Forgotten:** ${match.key}`, mutated: true };
        }
        return { response: `No memory note found matching "${cmd.key}".`, mutated: false };
      }
      await deleteMemoryNote(note.id);
      return { response: `**Forgotten:** ${note.key}`, mutated: true };
    }

    default:
      return { response: 'I didn\'t understand that memory command.', mutated: false };
  }
}
