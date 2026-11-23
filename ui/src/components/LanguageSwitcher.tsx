import { Globe } from 'lucide-react';
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

  return (
    <div
      data-testid="language-switcher"
      role="group"
      aria-label={t('common.language')}
      className="inline-flex items-center gap-0.5 rounded-full border border-white/10 bg-[#2a2a2a] p-0.5 text-xs"
    >
      <Globe className="mr-0.5 ml-1.5 h-3.5 w-3.5 text-[#8e8ea0]" aria-hidden="true" />
      {OPTIONS.map((opt) => {
        const isActive = locale === opt.code;
        return (
          <button
            key={opt.code}
            type="button"
            onClick={() => setLocale(opt.code)}
            aria-pressed={isActive}
            aria-label={opt.label}
            title={opt.label}
            className={[
              'rounded-full px-2 py-0.5 text-[11px] font-semibold transition-colors',
              isActive
                ? 'bg-[#10a37f] text-white'
                : 'text-[#b4b4b4] hover:text-white',
            ].join(' ')}
          >
            {compact ? opt.short : opt.label}
          </button>
        );
      })}
    </div>
  );
}
