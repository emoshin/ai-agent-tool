import type { AgentProvider, ProviderTokenConfig, ProviderTokenSubmission } from '../types/admin';
import type { BotAdapterMode } from '../types/chat';

export const DEFAULT_PROVIDER_TOKENS: ProviderTokenConfig[] = [
  {
    provider: 'openai',
    label: 'ChatGPT (OpenAI)',
    apiKey: '',
    baseUrl: 'https://api.openai.com/v1',
    updatedAt: null,
  },
  {
    provider: 'anthropic',
    label: 'Claude (Anthropic)',
    apiKey: '',
    baseUrl: 'https://api.anthropic.com/v1',
    updatedAt: null,
  },
];

export function maskApiKey(apiKey: string): string {
  const trimmed = apiKey.trim();
  if (!trimmed) return '';
  if (trimmed.length <= 8) return '••••••••';
  return `${trimmed.slice(0, 5)}••••••${trimmed.slice(-4)}`;
}

export interface TokenSaveResult {
  config: ProviderTokenConfig;
  syncedToBackend: boolean;
  message: string;
}

/**
 * Persists a provider API token. When the UI is connected to the Java + PostgreSQL
 * backend (`mode === 'api'`), it submits to `/api/admin/provider-tokens` so the
 * backend can store the encrypted credential in Postgres.
 */
export async function submitProviderToken(
  submission: ProviderTokenSubmission,
  mode: BotAdapterMode,
  endpointBase = '/api/admin/provider-tokens',
  authToken?: string
): Promise<TokenSaveResult> {
  const cleanKey = submission.apiKey.trim();
  const cleanBaseUrl =
    submission.baseUrl.trim() ||
    (submission.provider === 'openai'
      ? 'https://api.openai.com/v1'
      : 'https://api.anthropic.com/v1');

  const label =
    submission.provider === 'openai' ? 'ChatGPT (OpenAI)' : 'Claude (Anthropic)';

  const config: ProviderTokenConfig = {
    provider: submission.provider,
    label,
    apiKey: cleanKey,
    baseUrl: cleanBaseUrl,
    updatedAt: Date.now(),
  };

  if (mode === 'api') {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (authToken?.trim()) {
      headers.Authorization = `Bearer ${authToken.trim()}`;
    }

    const response = await fetch(endpointBase, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        provider: submission.provider,
        apiKey: cleanKey,
        baseUrl: cleanBaseUrl,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      throw new Error(
        `Failed to store token in backend (${response.status})${errorText ? `: ${errorText.slice(0, 150)}` : ''}`
      );
    }

    return {
      config,
      syncedToBackend: true,
      message: `${label} API token saved and synced to backend database.`,
    };
  }

  return {
    config,
    syncedToBackend: false,
    message: `${label} API token saved locally (ready for Java/Postgres sync when backend is connected).`,
  };
}

export async function removeProviderToken(
  provider: AgentProvider,
  mode: BotAdapterMode,
  endpointBase = '/api/admin/provider-tokens',
  authToken?: string
): Promise<void> {
  if (mode === 'api') {
    const headers: Record<string, string> = {};
    if (authToken?.trim()) {
      headers.Authorization = `Bearer ${authToken.trim()}`;
    }
    const response = await fetch(`${endpointBase}/${encodeURIComponent(provider)}`, {
      method: 'DELETE',
      headers,
    });
    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      throw new Error(
        `Failed to delete token from backend (${response.status})${errorText ? `: ${errorText.slice(0, 150)}` : ''}`
      );
    }
  }
}
