import type { BackendModelUsage } from './auth';
import type { ChatMessage, ChatSession } from './chat';

export type UserStatus = 'active' | 'suspended';
export type UserRole = 'admin' | 'member' | 'viewer';

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  tokenLimit: number;
  estimatedCostUsd?: number;
}

export interface ManagedUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  avatarUrl: string;
  createdAt: number;
  lastActiveAt: number;
  tokenUsage: TokenUsage;
  modelBreakdown?: BackendModelUsage[];
  chats: ChatSession[];
  isCurrentUser?: boolean;
}

export interface CreateUserInput {
  name: string;
  email: string;
  role: UserRole;
  tokenLimit: number;
  avatarUrl: string;
}

export type AgentProvider = 'openai' | 'anthropic';

export interface ProviderTokenConfig {
  provider: AgentProvider;
  label: string;
  apiKey: string;
  baseUrl: string;
  updatedAt: number | null;
}

export interface ProviderTokenSubmission {
  provider: AgentProvider;
  apiKey: string;
  baseUrl: string;
}

export interface OpenAiOrgCostsResponse {
  available: boolean;
  periodDays: number;
  totalSpendUsd: number;
  remainingBalanceSupported: boolean;
  source: string;
  message: string;
}

export interface ChatBackupPayload {
  backupVersion: string;
  exportedAt: number;
  chatId: string;
  userId: string;
  userName: string;
  userEmail: string;
  title: string;
  model: string;
  provider: string;
  deletedByUser: boolean;
  deletedAt: number | null;
  createdAt: number;
  updatedAt: number;
  messageCount: number;
  totalTokens: number;
  estimatedCostUsd: number;
  messages: Array<Pick<ChatMessage, 'id' | 'role' | 'content' | 'createdAt'> & { tokenCount: number }>;
}

export interface WorkspaceChatsBackupPayload {
  backupVersion: string;
  exportedAt: number;
  totalChats: number;
  deletedChats: number;
  chats: ChatBackupPayload[];
}
