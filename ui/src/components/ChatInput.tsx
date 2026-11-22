import { useEffect, useRef, type KeyboardEvent } from 'react';
import { ArrowUp, Square } from 'lucide-react';

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
    <div className="mx-auto w-full max-w-3xl px-4 pt-2 pb-4">
      <div className="relative flex items-end gap-2 rounded-3xl border border-white/10 bg-[#2f2f2f] px-4 py-2.5 shadow-lg focus-within:border-white/20">
        <textarea
          ref={textareaRef}
          rows={1}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={disabled ? 'Account suspended — messaging disabled' : 'Message AI Bot...'}
          aria-label="Message AI Bot"
          className="max-h-[200px] min-h-[26px] flex-1 resize-none bg-transparent py-1 text-[0.96875rem] leading-6 text-[#ececec] placeholder-[#8e8ea0] outline-none disabled:cursor-not-allowed disabled:opacity-60"
        />

        {isStreaming ? (
          <button
            type="button"
            onClick={onStop}
            className="mb-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-[#212121] transition-opacity hover:opacity-90"
            title="Stop generating"
            aria-label="Stop generating"
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
            title="Send message"
            aria-label="Send message"
          >
            <ArrowUp className="h-4 w-4 stroke-[2.5]" />
          </button>
        )}
      </div>
      <p className="mt-2 text-center text-[11px] text-[#8e8ea0]">
        AI can make mistakes. Press <kbd className="rounded bg-white/10 px-1 py-0.5">Enter</kbd> to send,{' '}
        <kbd className="rounded bg-white/10 px-1 py-0.5">Shift+Enter</kbd> for newline.
      </p>
    </div>
  );
}
