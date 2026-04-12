import { DashboardShell } from '@/components/dashboard-shell';
import { ensureInitialSystemMessage, listChatMessages } from '@/lib/chat';

import { ChatThread } from './chat-thread';

export default async function ChatPage() {
  await ensureInitialSystemMessage();
  const messages = await listChatMessages();

  return (
    <DashboardShell
      active="chat"
      title="Chat"
      subtitle="Chat with Scot, your Mission Control AI assistant."
    >
      <ChatThread initialMessages={messages} />
    </DashboardShell>
  );
}
