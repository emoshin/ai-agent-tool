import { useEffect, useState, type FormEvent } from 'react';
import { CheckCircle2, Database, Eye, EyeOff, KeyRound, Trash2 } from 'lucide-react';
import type { AgentProvider, ProviderTokenConfig, ProviderTokenSubmission } from '../../types/admin';
import type { BotAdapterMode } from '../../types/chat';
import { maskApiKey } from '../../services/providerTokensService';
import { ChatGptIcon, ClaudeIcon } from '../ModelIcon';

interface ProviderTokensTabProps {
  tokens: ProviderTokenConfig[];
  botMode: BotAdapterMode;
  onSaveToken: (submission: ProviderTokenSubmission) => Promise<string>;
  onDeleteToken: (provider: AgentProvider) => Promise<void>;
}

interface ProviderCardProps {
  config: ProviderTokenConfig;
  onSaveToken: (submission: ProviderTokenSubmission) => Promise<string>;
  onDeleteToken: (provider: AgentProvider) => Promise<void>;
}

function ProviderTokenCard({ config, onSaveToken, onDeleteToken }: ProviderCardProps) {
  const isMasked = config.apiKey.includes('••••');
  const [apiKeyInput, setApiKeyInput] = useState(isMasked ? '' : config.apiKey);
  const [baseUrlInput, setBaseUrlInput] = useState(config.baseUrl);
  const [showKey, setShowKey] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    setBaseUrlInput(config.baseUrl);
    if (!config.apiKey.includes('••••')) {
      setApiKeyInput(config.apiKey);
    }
  }, [config.apiKey, config.baseUrl]);

  const isOpenAi = config.provider === 'openai';
  const isConfigured = Boolean(config.apiKey.trim());
  const displayMaskedKey = isMasked ? config.apiKey : maskApiKey(config.apiKey);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const trimmedKey = apiKeyInput.trim();
    if (!trimmedKey) {
      setFeedback({ type: 'error', text: 'API token cannot be empty.' });
      return;
    }

    setSubmitting(true);
    setFeedback(null);
    try {
      const msg = await onSaveToken({
        provider: config.provider,
        apiKey: trimmedKey,
        baseUrl: baseUrlInput.trim(),
      });
      setFeedback({ type: 'success', text: msg });
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to save API token.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleClear = async () => {
    setSubmitting(true);
    setFeedback(null);
    try {
      await onDeleteToken(config.provider);
      setApiKeyInput('');
      setFeedback({ type: 'success', text: `${config.label} token removed.` });
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to remove API token.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="rounded-2xl border border-white/10 bg-[#1b1b1b] p-5"
      data-testid={`provider-token-card-${config.provider}`}
    >
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className={[
              'flex h-10 w-10 items-center justify-center rounded-xl border',
              isOpenAi
                ? 'border-[#10a37f]/30 bg-[#10a37f]/15 text-[#10a37f]'
                : 'border-[#d97757]/30 bg-[#d97757]/15 text-[#d97757]',
            ].join(' ')}
          >
            {isOpenAi ? <ChatGptIcon className="h-5 w-5" /> : <ClaudeIcon className="h-5 w-5" />}
          </div>
          <div>
            <h3 className="text-base font-semibold text-white">{config.label}</h3>
            <p className="text-xs text-[#8e8ea0]">
              {isOpenAi
                ? 'Used by ChatGPT 4o and o3-mini agent workflows'
                : 'Used by Claude Sonnet 4 and Opus 4 agent workflows'}
            </p>
          </div>
        </div>

        <span
          className={[
            'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium',
            isConfigured
              ? 'bg-[#10a37f]/15 text-[#10a37f]'
              : 'bg-white/5 text-[#8e8ea0]',
          ].join(' ')}
        >
          <span
            className={[
              'h-1.5 w-1.5 rounded-full',
              isConfigured ? 'bg-[#10a37f]' : 'bg-[#8e8ea0]',
            ].join(' ')}
          />
          {isConfigured ? `Configured (${displayMaskedKey})` : 'Not configured'}
        </span>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label
            htmlFor={`token-input-${config.provider}`}
            className="mb-1.5 block text-xs font-medium text-[#b4b4b4]"
          >
            {isOpenAi ? 'OpenAI / ChatGPT API Token' : 'Anthropic / Claude API Token'}
          </label>
          <div className="relative flex items-center">
            <KeyRound className="pointer-events-none absolute left-3 h-4 w-4 text-[#8e8ea0]" />
            <input
              id={`token-input-${config.provider}`}
              type={showKey ? 'text' : 'password'}
              value={apiKeyInput}
              onChange={(e) => {
                setApiKeyInput(e.target.value);
                setFeedback(null);
              }}
              placeholder={
                isConfigured && isMasked
                  ? 'Token stored in PostgreSQL — enter new key to replace'
                  : isOpenAi
                    ? 'sk-proj-...'
                    : 'sk-ant-api03-...'
              }
              autoComplete="off"
              className="w-full rounded-xl border border-white/10 bg-[#242424] py-2 pr-10 pl-9 font-mono text-sm text-white placeholder-[#6b7280] outline-none focus:border-white/30"
            />
            <button
              type="button"
              onClick={() => setShowKey((prev) => !prev)}
              className="absolute right-2.5 rounded-md p-1 text-[#8e8ea0] hover:bg-white/10 hover:text-white"
              aria-label={showKey ? `Hide ${config.label} token` : `Show ${config.label} token`}
            >
              {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <div>
          <label
            htmlFor={`baseurl-input-${config.provider}`}
            className="mb-1.5 block text-xs font-medium text-[#b4b4b4]"
          >
            Provider Base URL
          </label>
          <input
            id={`baseurl-input-${config.provider}`}
            type="text"
            value={baseUrlInput}
            onChange={(e) => {
              setBaseUrlInput(e.target.value);
              setFeedback(null);
            }}
            placeholder={isOpenAi ? 'https://api.openai.com/v1' : 'https://api.anthropic.com/v1'}
            className="w-full rounded-xl border border-white/10 bg-[#242424] px-3 py-2 font-mono text-xs text-[#ececec] placeholder-[#6b7280] outline-none focus:border-white/30"
          />
        </div>

        {feedback && (
          <div
            role="status"
            className={[
              'flex items-center gap-2 rounded-xl border px-3 py-2 text-xs',
              feedback.type === 'success'
                ? 'border-[#10a37f]/30 bg-[#10a37f]/10 text-[#6ee7b7]'
                : 'border-red-500/30 bg-red-500/10 text-red-200',
            ].join(' ')}
          >
            {feedback.type === 'success' && <CheckCircle2 className="h-4 w-4 shrink-0" />}
            <span>{feedback.text}</span>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <span className="text-[11px] text-[#8e8ea0]">
            {config.updatedAt
              ? `Last updated: ${new Date(config.updatedAt).toLocaleString()}`
              : 'No token submitted yet'}
          </span>

          <div className="flex items-center gap-2">
            {isConfigured && (
              <button
                type="button"
                disabled={submitting}
                onClick={handleClear}
                className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-[#252525] px-3 py-2 text-xs font-medium text-[#b4b4b4] transition-colors hover:border-red-500/40 hover:bg-red-500/15 hover:text-red-300 disabled:opacity-50"
                aria-label={`Remove ${config.label} token`}
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Remove</span>
              </button>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-1.5 rounded-xl bg-white px-4 py-2 text-xs font-semibold text-[#212121] transition-colors hover:bg-[#e5e5e5] disabled:opacity-50"
            >
              <span>{submitting ? 'Saving...' : `Save ${isOpenAi ? 'ChatGPT' : 'Claude'} Token`}</span>
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

export function ProviderTokensTab({
  tokens,
  botMode,
  onSaveToken,
  onDeleteToken,
}: ProviderTokensTabProps) {
  return (
    <div className="space-y-6">
      {/* Backend / PostgreSQL Persistence Banner */}
      <div className="flex items-start gap-3 rounded-2xl border border-white/10 bg-[#1b1b1b] p-4">
        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sky-500/15 text-sky-400">
          <Database className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1 text-xs leading-relaxed text-[#b4b4b4]">
          <div className="text-sm font-semibold text-white">
            Agent Provider Credentials (PostgreSQL-Ready)
          </div>
          <p className="mt-1">
            Submit API tokens for <strong>ChatGPT (OpenAI)</strong> and{' '}
            <strong>Claude (Anthropic)</strong> agents below.{' '}
            {botMode === 'api'
              ? 'API mode is active: submissions are sent to POST /api/admin/provider-tokens for PostgreSQL storage.'
              : 'Currently in Simulated Mode: tokens are stored locally in the browser and structured to sync to POST /api/admin/provider-tokens when the Java + PostgreSQL backend is connected.'}
          </p>
        </div>
      </div>

      {/* Provider Token Cards */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {tokens.map((config) => (
          <ProviderTokenCard
            key={config.provider}
            config={config}
            onSaveToken={onSaveToken}
            onDeleteToken={onDeleteToken}
          />
        ))}
      </div>
    </div>
  );
}
