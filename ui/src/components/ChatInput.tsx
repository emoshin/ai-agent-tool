import { useEffect, useRef, type KeyboardEvent } from 'react';
import { ArrowUp, Square } from 'lucide-react';
import { useI18n } from '../i18n/I18nContext';

interface ChatInputProps {
  value: string;
  isStreaming: boolean;
  disabled?: boolean;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onStop: () => void;
}

export function ChatInput({
  value,
  isStreaming,
  disabled = false,
  onChange,
  onSubmit,
  onStop,
}: ChatInputProps) {
  const { t } = useI18n();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [value]);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!disabled && !isStreaming && value.trim()) {
        onSubmit();
      }
    }
  };

  const canSend = !disabled && value.trim().length > 0;

  return (
    <div className="mx-auto w-full max-w-3xl px-2.5 pt-1.5 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-4 sm:pt-2 sm:pb-4">
      <div className="relative flex items-end gap-2 rounded-2xl border border-white/10 bg-[#2f2f2f] px-3 py-2 shadow-lg focus-within:border-white/20 sm:rounded-3xl sm:px-4 sm:py-2.5">
        <textarea
          ref={textareaRef}
          rows={1}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={disabled ? t('chat.inputPlaceholderSuspended') : t('chat.inputPlaceholder')}
          aria-label={t('chat.inputAria')}
          className="max-h-[200px] min-h-[26px] flex-1 resize-none bg-transparent py-1 text-base leading-6 text-[#ececec] placeholder-[#8e8ea0] outline-none disabled:cursor-not-allowed disabled:opacity-60 sm:text-[0.96875rem]"
        />

        {isStreaming ? (
          <button
            type="button"
            onClick={onStop}
            className="mb-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-[#212121] transition-opacity hover:opacity-90"
            title={t('chat.stopGenerating')}
            aria-label={t('chat.stopGenerating')}
          >
            <Square className="h-4 w-4 fill-current" />
          </button>
        ) : (
          <button
            type="button"
            onClick={onSubmit}
            disabled={!canSend}
            className={[
              'mb-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors',
              canSend
                ? 'bg-white text-[#212121] hover:bg-[#e5e5e5]'
                : 'cursor-not-allowed bg-[#424242] text-[#8e8ea0]',
            ].join(' ')}
            title={t('chat.sendMessage')}
            aria-label={t('chat.sendMessage')}
          >
            <ArrowUp className="h-4 w-4 stroke-[2.5]" />
          </button>
        )}
      </div>
      <p className="mt-2 hidden text-center text-[11px] text-[#8e8ea0] sm:block">
        {t('chat.disclaimerPrefix')}
        <kbd className="rounded bg-white/10 px-1 py-0.5">Enter</kbd>
        {t('chat.disclaimerMiddle')}
        <kbd className="rounded bg-white/10 px-1 py-0.5">Shift+Enter</kbd>
        {t('chat.disclaimerSuffix')}
      </p>
    </div>
  );
}
