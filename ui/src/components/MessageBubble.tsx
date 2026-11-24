import { useState } from 'react';
import { AlertCircle, Check, Copy, RotateCcw } from 'lucide-react';
import { useI18n } from '../i18n/I18nContext';
import type { ChatMessage, UserProfile } from '../types/chat';
import { getModelProvider } from '../utils/defaults';
import { MarkdownRenderer } from './MarkdownRenderer';
import { ModelIcon } from './ModelIcon';

interface MessageBubbleProps {
  message: ChatMessage;
  userProfile: UserProfile;
  modelId?: string;
  isLastAssistantMessage: boolean;
  isStreamingAny: boolean;
  onRegenerate?: () => void;
}

export function MessageBubble({
  message,
  userProfile,
  modelId,
  isLastAssistantMessage,
  isStreamingAny,
  onRegenerate,
}: MessageBubbleProps) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Ignore clipboard failures
    }
  };

  if (message.role === 'user') {
    return (
      <div className="group flex justify-end gap-2.5 py-2.5 sm:gap-3 sm:py-3" data-testid="user-message">
        <div className="flex max-w-[88%] flex-col items-end gap-1 sm:max-w-[75%]">
          <div className="rounded-2xl bg-[#2f2f2f] px-3.5 py-2.5 text-[0.9375rem] leading-relaxed break-words whitespace-pre-wrap text-[#ececec] sm:rounded-3xl sm:px-4 sm:text-[0.96875rem]">
            {message.content}
          </div>
          <div className="flex items-center gap-1 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:focus-within:opacity-100">
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-[#8e8ea0] hover:bg-white/10 hover:text-white"
              aria-label={t('chat.copyUserMessage')}
            >
              {copied ? <Check className="h-3.5 w-3.5 text-[#10a37f]" /> : <Copy className="h-3.5 w-3.5" />}
            </button>
          </div>
        </div>
        <img
          src={userProfile.avatarUrl}
          alt={userProfile.name}
          className="mt-0.5 hidden h-8 w-8 shrink-0 rounded-full border border-white/10 object-cover sm:block"
        />
      </div>
    );
  }

  const provider = getModelProvider(modelId ?? '');

  return (
    <div className="group flex items-start gap-2.5 py-3 sm:gap-3.5 sm:py-3.5" data-testid="assistant-message">
      <div
        className={[
          'mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border sm:h-8 sm:w-8',
          message.isError
            ? 'border-red-500/40 bg-red-500/15 text-red-300'
            : provider === 'anthropic'
              ? 'border-[#d97757]/40 bg-[#d97757]/15'
              : 'border-white/15 bg-[#10a37f]/20',
        ].join(' ')}
        aria-hidden="true"
      >
        {message.isError ? (
          <AlertCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
        ) : (
          <ModelIcon modelId={modelId} className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div
          className={
            message.isError
              ? 'rounded-xl border border-red-500/30 bg-red-500/10 px-3.5 py-2.5 text-sm text-red-200 sm:px-4 sm:py-3'
              : ''
          }
        >
          {message.content ? (
            <MarkdownRenderer content={message.content} />
          ) : message.isStreaming ? (
            <div className="flex items-center gap-1.5 py-2 text-sm text-[#8e8ea0]" aria-label={t('chat.aiTyping')}>
              <span className="h-2 w-2 animate-bounce rounded-full bg-[#b4b4b4] [animation-delay:-0.3s]" />
              <span className="h-2 w-2 animate-bounce rounded-full bg-[#b4b4b4] [animation-delay:-0.15s]" />
              <span className="h-2 w-2 animate-bounce rounded-full bg-[#b4b4b4]" />
            </div>
          ) : null}

          {message.isStreaming && message.content && (
            <span
              className="ml-1 inline-block h-4 w-2 animate-pulse rounded-xs bg-[#ececec] align-middle"
              aria-hidden="true"
            />
          )}
        </div>

        {!message.isStreaming && message.content && (
          <div className="mt-1.5 flex items-center gap-1 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:focus-within:opacity-100">
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-[#8e8ea0] transition-colors hover:bg-white/10 hover:text-white"
              title={t('chat.copyResponse')}
              aria-label={t('chat.copyResponse')}
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5 text-[#10a37f]" />
                  <span className="text-[#10a37f]">{t('chat.copied')}</span>
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" />
                  <span>{t('chat.copy')}</span>
                </>
              )}
            </button>

            {isLastAssistantMessage && onRegenerate && !isStreamingAny && (
              <button
                type="button"
                onClick={onRegenerate}
                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-[#8e8ea0] transition-colors hover:bg-white/10 hover:text-white"
                title={t('chat.regenerateResponse')}
                aria-label={t('chat.regenerateResponse')}
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>{t('chat.regenerate')}</span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
