import type {
  AgentProvider,
  ChatBackupPayload,
  CreateUserInput,
  ManagedUser,
  OpenAiOrgCostsResponse,
  ProviderTokenConfig,
  UserRole,
  UserStatus,
  WorkspaceChatsBackupPayload,
} from '../types/admin';
import type { BackendUserProfile } from '../types/auth';
import type { ChatSession } from '../types/chat';
import { DEFAULT_AVATAR_SVG } from '../utils/defaults';

interface BackendChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  tokenCount: number;
  createdAt: number;
}

interface BackendChatSession {
  id: string;
  title: string;
  model: string;
  provider: string;
  createdAt: number;
  updatedAt: number;
  deleted?: boolean;
  deletedAt?: number | null;
  messages: BackendChatMessage[];
}

interface BackendAdminUser extends BackendUserProfile {
  chatCount: number;
}

interface BackendProviderToken {
  provider: AgentProvider;
  label: string;
  baseUrl: string;
  configured: boolean;
  maskedKey: string;
  updatedAt: number | null;
}

async function ensureOk(response: Response, fallback: string): Promise<void> {
  if (response.ok) return;
  let message = `${fallback} (${response.status})`;
  try {
    const data = (await response.json()) as { message?: string };
    if (data.message) message = data.message;
  } catch {
    // ignore
  }
  const err = new Error(message) as Error & { status?: number };
  err.status = response.status;
  throw err;
}

function mapChatSession(chat: BackendChatSession): ChatSession {
  return {
    id: chat.id,
    title: chat.title,
    model: chat.model,
    createdAt: chat.createdAt,
    updatedAt: chat.updatedAt,
    deletedByUser: Boolean(chat.deleted),
    deletedAt: chat.deletedAt ?? null,
    messages: chat.messages.map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      createdAt: m.createdAt,
      tokenCount: m.tokenCount,
    })),
  };
}

function mapAdminUser(
  user: BackendAdminUser,
  currentUserId: string,
  chats: ChatSession[] = []
): ManagedUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role.toLowerCase() as UserRole,
    status: user.status.toLowerCase() as UserStatus,
    avatarUrl: user.avatarUrl || DEFAULT_AVATAR_SVG,
    createdAt: user.createdAt,
    lastActiveAt: user.lastActiveAt,
    tokenUsage: user.tokenUsage,
    modelBreakdown: user.modelBreakdown ?? [],
    chats,
    isCurrentUser: user.id === currentUserId,
  };
}

export async function fetchUserChats(accessToken: string): Promise<ChatSession[]> {
  const response = await fetch('/api/chats', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  await ensureOk(response, 'Failed to load chats');
  const data = (await response.json()) as BackendChatSession[];
  return data.map(mapChatSession);
}

export async function renameBackendChat(
  accessToken: string,
  chatId: string,
  title: string
): Promise<ChatSession> {
  const response = await fetch(`/api/chats/${encodeURIComponent(chatId)}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ title }),
  });
  await ensureOk(response, 'Failed to rename chat');
  const data = (await response.json()) as BackendChatSession;
  return mapChatSession(data);
}

export async function deleteBackendChat(accessToken: string, chatId: string): Promise<void> {
  const response = await fetch(`/api/chats/${encodeURIComponent(chatId)}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (response.status === 404) return;
  await ensureOk(response, 'Failed to delete chat');
}

export async function fetchAdminUsers(
  accessToken: string,
  currentUserId: string
): Promise<ManagedUser[]> {
  const response = await fetch('/api/admin/users', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  await ensureOk(response, 'Failed to load users');
  const users = (await response.json()) as BackendAdminUser[];

  const withChats = await Promise.all(
    users.map(async (u) => {
      try {
        const chats = await fetchAdminUserChats(accessToken, u.id);
        return mapAdminUser(u, currentUserId, chats);
      } catch {
        return mapAdminUser(u, currentUserId, []);
      }
    })
  );
  return withChats;
}

export async function fetchAdminUserChats(
  accessToken: string,
  userId: string
): Promise<ChatSession[]> {
  const response = await fetch(`/api/admin/users/${encodeURIComponent(userId)}/chats`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  await ensureOk(response, 'Failed to load user chats');
  const data = (await response.json()) as BackendChatSession[];
  return data.map(mapChatSession);
}

export async function createAdminUser(
  accessToken: string,
  input: CreateUserInput,
  currentUserId: string
): Promise<ManagedUser> {
  const response = await fetch('/api/admin/users', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      name: input.name,
      email: input.email,
      ...(input.password ? { password: input.password } : {}),
      role: input.role.toUpperCase(),
      tokenLimit: input.tokenLimit,
      avatarUrl: input.avatarUrl,
    }),
  });
  await ensureOk(response, 'Failed to create user');
  const created = (await response.json()) as BackendAdminUser;
  return mapAdminUser(created, currentUserId, []);
}

export async function updateAdminUserStatus(
  accessToken: string,
  userId: string,
  status: UserStatus,
  currentUserId: string
): Promise<ManagedUser> {
  const response = await fetch(`/api/admin/users/${encodeURIComponent(userId)}/status`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ status: status.toUpperCase() }),
  });
  await ensureOk(response, 'Failed to update user status');
  const updated = (await response.json()) as BackendAdminUser;
  return mapAdminUser(updated, currentUserId, []);
}

export async function setAdminUserPassword(
  accessToken: string,
  userId: string,
  password: string
): Promise<void> {
  const response = await fetch(`/api/admin/users/${encodeURIComponent(userId)}/password`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ password }),
  });
  await ensureOk(response, 'Failed to update user password');
}

export async function deleteAdminUser(accessToken: string, userId: string): Promise<void> {
  const response = await fetch(`/api/admin/users/${encodeURIComponent(userId)}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  await ensureOk(response, 'Failed to delete user');
}

export async function deleteAdminUserChat(
  accessToken: string,
  userId: string,
  chatId: string
): Promise<void> {
  const response = await fetch(
    `/api/admin/users/${encodeURIComponent(userId)}/chats/${encodeURIComponent(chatId)}`,
    {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );
  await ensureOk(response, 'Failed to delete user chat');
}

export async function fetchAdminProviderTokens(
  accessToken: string
): Promise<ProviderTokenConfig[]> {
  const response = await fetch('/api/admin/provider-tokens', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  await ensureOk(response, 'Failed to load provider token status');
  const list = (await response.json()) as BackendProviderToken[];
  return list.map((item) => ({
    provider: item.provider,
    label: item.label,
    apiKey: item.configured ? item.maskedKey : '',
    baseUrl: item.baseUrl,
    updatedAt: item.updatedAt,
  }));
}

export async function fetchOpenAiOrgCosts(
  accessToken: string,
  adminApiKey?: string,
  days = 30
): Promise<OpenAiOrgCostsResponse> {
  const response = await fetch('/api/admin/billing/openai-costs', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      adminApiKey: adminApiKey?.trim() || null,
      days,
    }),
  });
  await ensureOk(response, 'Failed to query OpenAI billing');
  return (await response.json()) as OpenAiOrgCostsResponse;
}

export async function backupAdminChat(
  accessToken: string,
  chatId: string
): Promise<ChatBackupPayload> {
  const response = await fetch(`/api/admin/chats/${encodeURIComponent(chatId)}/backup`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  await ensureOk(response, 'Failed to backup chat');
  return (await response.json()) as ChatBackupPayload;
}

export async function backupAdminUserChats(
  accessToken: string,
  userId: string
): Promise<WorkspaceChatsBackupPayload> {
  const response = await fetch(`/api/admin/users/${encodeURIComponent(userId)}/chats/backup`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  await ensureOk(response, 'Failed to backup user chats');
  return (await response.json()) as WorkspaceChatsBackupPayload;
}

export async function backupAllAdminChats(
  accessToken: string
): Promise<WorkspaceChatsBackupPayload> {
  const response = await fetch('/api/admin/chats/backup', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  await ensureOk(response, 'Failed to backup workspace chats');
  return (await response.json()) as WorkspaceChatsBackupPayload;
}
