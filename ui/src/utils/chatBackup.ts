import type {
  ChatBackupPayload,
  ManagedUser,
  WorkspaceChatsBackupPayload,
} from '../types/admin';
import type { ChatSession } from '../types/chat';
import { getModelProvider } from './defaults';
import { computeChatTokenBreakdown, estimateModelCostUsd, getMessageTokens } from './tokens';

export function buildChatBackupPayload(
  user: Pick<ManagedUser, 'id' | 'name' | 'email'>,
  chat: ChatSession,
  exportedAt = Date.now()
): ChatBackupPayload {
  const breakdown = computeChatTokenBreakdown(chat);
  return {
    backupVersion: '1.0',
    exportedAt,
    chatId: chat.id,
    userId: user.id,
    userName: user.name,
    userEmail: user.email,
    title: chat.title,
    model: chat.model,
    provider: getModelProvider(chat.model),
    deletedByUser: Boolean(chat.deletedByUser),
    deletedAt: chat.deletedAt ?? null,
    createdAt: chat.createdAt,
    updatedAt: chat.updatedAt,
    messageCount: chat.messages.length,
    totalTokens: breakdown.totalTokens,
    estimatedCostUsd: estimateModelCostUsd(
      chat.model,
      breakdown.promptTokens,
      breakdown.completionTokens
    ),
    messages: chat.messages.map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      tokenCount: getMessageTokens(m),
      createdAt: m.createdAt,
    })),
  };
}

export function buildUserChatsBackupPayload(
  user: ManagedUser,
  exportedAt = Date.now()
): WorkspaceChatsBackupPayload {
  const chats = user.chats.map((chat) => buildChatBackupPayload(user, chat, exportedAt));
  return {
    backupVersion: '1.0',
    exportedAt,
    totalChats: chats.length,
    deletedChats: chats.filter((c) => c.deletedByUser).length,
    chats,
  };
}

export function buildWorkspaceChatsBackupPayload(
  users: ManagedUser[],
  exportedAt = Date.now()
): WorkspaceChatsBackupPayload {
  const chats = users.flatMap((user) =>
    user.chats.map((chat) => buildChatBackupPayload(user, chat, exportedAt))
  );
  return {
    backupVersion: '1.0',
    exportedAt,
    totalChats: chats.length,
    deletedChats: chats.filter((c) => c.deletedByUser).length,
    chats,
  };
}

export function downloadJsonBackup(filename: string, payload: unknown): void {
  if (typeof document === 'undefined' || typeof URL === 'undefined') {
    return;
  }
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const createUrl = typeof URL.createObjectURL === 'function' ? URL.createObjectURL : null;
  if (!createUrl) {
    return;
  }

  const url = createUrl(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  if (typeof URL.revokeObjectURL === 'function') {
    URL.revokeObjectURL(url);
  }
}
