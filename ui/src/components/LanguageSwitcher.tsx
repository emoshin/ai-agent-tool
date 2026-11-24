import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, Globe } from 'lucide-react';
import { useI18n, type Locale } from '../i18n/I18nContext';

interface LanguageSwitcherProps {
  compact?: boolean;
}

const OPTIONS: Array<{ code: Locale; short: string; label: string }> = [
  { code: 'en', short: 'EN', label: 'English' },
  { code: 'ru', short: 'RU', label: 'Русский' },
];

export function LanguageSwitcher({ compact = true }: LanguageSwitcherProps) {
  const { locale, setLocale, t } = useI18n();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const activeOption = OPTIONS.find((opt) => opt.code === locale) ?? OPTIONS[0];

  useEffect(() => {
    if (!open) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  return (
    <div ref={containerRef} data-testid="language-switcher" className="relative inline-block text-left">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`${t('common.language')}: ${activeOption.label}`}
        title={t('common.language')}
        className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-[#2a2a2a] px-2 py-1 text-xs font-medium text-[#ececec] transition-colors hover:border-white/20 hover:bg-[#333333] hover:text-white sm:gap-1.5 sm:px-2.5"
      >
        <Globe className="h-3.5 w-3.5 shrink-0 text-[#8e8ea0]" aria-hidden="true" />
        <span>{compact ? activeOption.short : activeOption.label}</span>
        <ChevronDown
          className={[
            'h-3.5 w-3.5 shrink-0 text-[#8e8ea0] transition-transform',
            open ? 'rotate-180' : '',
          ].join(' ')}
          aria-hidden="true"
        />
      </button>

      {open && (
        <div
          role="listbox"
          aria-label={t('common.language')}
          className="absolute right-0 z-40 mt-1.5 w-40 max-w-[calc(100vw-1rem)] rounded-xl border border-white/10 bg-[#2f2f2f] p-1 shadow-2xl"
        >
          {OPTIONS.map((opt) => {
            const isSelected = locale === opt.code;
            return (
              <button
                key={opt.code}
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={() => {
                  setLocale(opt.code);
                  setOpen(false);
                }}
                className={[
                  'flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs transition-colors',
                  isSelected
                    ? 'bg-white/10 font-semibold text-white'
                    : 'text-[#d1d5db] hover:bg-white/5 hover:text-white',
                ].join(' ')}
              >
                <span className="flex items-center gap-2">
                  <span className="inline-block w-5 text-[10px] font-semibold text-[#8e8ea0]">
                    {opt.short}
                  </span>
                  <span>{opt.label}</span>
                </span>
                {isSelected && <Check className="h-3.5 w-3.5 text-[#10a37f]" aria-hidden="true" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
