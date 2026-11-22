export interface BackendTokenUsageSummary {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  tokenLimit: number;
  estimatedCostUsd?: number;
}

export interface BackendModelUsage {
  model: string;
  provider: 'OPENAI' | 'ANTHROPIC';
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCostUsd?: number;
}

export interface BackendUserProfile {
  id: string;
  name: string;
  subtitle: string;
  email: string;
  role: 'ADMIN' | 'MEMBER' | 'VIEWER';
  status: 'ACTIVE' | 'SUSPENDED';
  avatarUrl: string | null;
  createdAt: number;
  lastActiveAt: number;
  tokenUsage: BackendTokenUsageSummary;
  modelBreakdown: BackendModelUsage[];
}

export interface BackendAuthSession {
  accessToken: string;
  user: BackendUserProfile;
}
