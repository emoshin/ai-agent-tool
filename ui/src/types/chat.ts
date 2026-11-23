export type MessageRole = 'user' | 'assistant' | 'system';

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  createdAt: number;
  isStreaming?: boolean;
  isError?: boolean;
  tokenCount?: number;
}

export interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  model: string;
  createdAt: number;
  updatedAt: number;
  deletedByUser?: boolean;
  deletedAt?: number | null;
}

export interface UserProfile {
  name: string;
  subtitle: string;
  avatarUrl: string;
}

export type BotAdapterMode = 'simulated' | 'api';

export interface BotSettings {
  mode: BotAdapterMode;
  apiEndpoint: string;
  apiKey: string;
  defaultModel: string;
  systemPrompt: string;
}

export type ModelProvider = 'openai' | 'anthropic' | 'custom';

export interface ModelOption {
  id: string;
  name: string;
  provider: ModelProvider;
  description: string;
}
