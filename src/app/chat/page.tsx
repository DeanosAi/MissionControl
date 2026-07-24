import { DashboardShell } from '@/components/dashboard-shell';
import { ensureInitialSystemMessage, listChatMessages } from '@/lib/chat';
import { getConversationWorkspaceContext } from '@/lib/conversation-workspace';
import { listOrchestrationRequests } from '@/lib/conversational-bridge/repository';

import { ChatThread } from './chat-thread';

export default async function ChatPage() {
  await ensureInitialSystemMessage();
  const [messages, requests] = await Promise.all([
    listChatMessages(),
    listOrchestrationRequests(),
  ]);
  const context = await getConversationWorkspaceContext(requests);

  return (
    <DashboardShell
      active="chat"
      title="Orchestrate"
      subtitle="Tell Mission Control what outcome you want. It will shape the solution, show you the experience, and wait for approval."
    >
      <ChatThread
        initialMessages={messages}
        initialRequests={requests}
        initialContext={context}
      />
    </DashboardShell>
  );
}
