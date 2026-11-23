import { useState, type FormEvent } from 'react';
import { AlertCircle, Bot, KeyRound, Lock, Mail, ShieldCheck, User, UserPlus } from 'lucide-react';
import { useI18n } from '../i18n/I18nContext';
import { loginUser, registerUser } from '../services/authService';
import type { BackendAuthSession } from '../types/auth';
import { LanguageSwitcher } from './LanguageSwitcher';

interface AuthScreenProps {
  initialNotice?: string | null;
  onAuthenticated: (session: BackendAuthSession) => void;
  onUseSimulatedMode: () => void;
}

export function AuthScreen({
  initialNotice = null,
  onAuthenticated,
  onUseSimulatedMode,
}: AuthScreenProps) {
  const { t } = useI18n();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(initialNotice);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const session =
        mode === 'login'
          ? await loginUser(email, password)
          : await registerUser({ name, email, password, subtitle });
      onAuthenticated(session);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('auth.failed'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleFillAdmin = () => {
    setMode('login');
    setEmail('admin@ai-agent-tool.dev');
    setPassword('admin123');
    setError(null);
  };

  return (
    <div className="flex min-h-dvh w-screen items-center justify-center bg-[#171717] p-4 text-[#ececec]">
      <div className="w-full max-w-md space-y-5 rounded-3xl border border-white/10 bg-[#212121] p-6 shadow-2xl sm:p-8">
        <div className="flex justify-end">
          <LanguageSwitcher />
        </div>

        {/* Brand Header */}
        <div className="flex flex-col items-center text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#10a37f]/20 text-[#10a37f]">
            <Bot className="h-6 w-6" />
          </div>
          <h1 className="text-xl font-semibold text-white">AI Agent Tool</h1>
          <p className="mt-1 text-xs text-[#8e8ea0]">
            {mode === 'login' ? t('auth.subtitleLogin') : t('auth.subtitleRegister')}
          </p>
        </div>

        {/* Mode Switch Tabs */}
        <div
          role="tablist"
          aria-label={t('auth.modeAria')}
          className="grid grid-cols-2 gap-1 rounded-xl border border-white/10 bg-[#171717] p-1"
        >
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'login'}
            onClick={() => {
              setMode('login');
              setError(null);
            }}
            className={[
              'inline-flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-medium transition-colors',
              mode === 'login'
                ? 'bg-[#2a2a2a] text-white'
                : 'text-[#8e8ea0] hover:text-[#ececec]',
            ].join(' ')}
          >
            <KeyRound className="h-3.5 w-3.5" />
            <span>{t('common.signIn')}</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'register'}
            onClick={() => {
              setMode('register');
              setError(null);
            }}
            className={[
              'inline-flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-medium transition-colors',
              mode === 'register'
                ? 'bg-[#2a2a2a] text-white'
                : 'text-[#8e8ea0] hover:text-[#ececec]',
            ].join(' ')}
          >
            <UserPlus className="h-3.5 w-3.5" />
            <span>{t('auth.createAccount')}</span>
          </button>
        </div>

        {/* Error Alert */}
        {error && (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-3.5 py-2.5 text-xs text-red-200"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
            <span>{error}</span>
          </div>
        )}

        {/* Auth Form */}
        <form onSubmit={handleSubmit} className="space-y-3.5">
          {mode === 'register' && (
            <>
              <div>
                <label htmlFor="auth-name" className="mb-1 block text-xs font-medium text-[#b4b4b4]">
                  {t('auth.fullName')}
                </label>
                <div className="relative flex items-center">
                  <User className="pointer-events-none absolute left-3 h-4 w-4 text-[#8e8ea0]" />
                  <input
                    id="auth-name"
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Alex Morgan"
                    className="w-full rounded-xl border border-white/10 bg-[#2a2a2a] py-2 pr-3 pl-9 text-sm text-white placeholder-[#6b7280] outline-none focus:border-white/30"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="auth-subtitle"
                  className="mb-1 block text-xs font-medium text-[#b4b4b4]"
                >
                  {t('auth.roleTitleOptional')}
                </label>
                <input
                  id="auth-subtitle"
                  type="text"
                  value={subtitle}
                  onChange={(e) => setSubtitle(e.target.value)}
                  placeholder="Workspace Member"
                  className="w-full rounded-xl border border-white/10 bg-[#2a2a2a] px-3 py-2 text-sm text-white placeholder-[#6b7280] outline-none focus:border-white/30"
                />
              </div>
            </>
          )}

          <div>
            <label htmlFor="auth-email" className="mb-1 block text-xs font-medium text-[#b4b4b4]">
              {t('auth.emailAddress')}
            </label>
            <div className="relative flex items-center">
              <Mail className="pointer-events-none absolute left-3 h-4 w-4 text-[#8e8ea0]" />
              <input
                id="auth-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                className="w-full rounded-xl border border-white/10 bg-[#2a2a2a] py-2 pr-3 pl-9 text-sm text-white placeholder-[#6b7280] outline-none focus:border-white/30"
              />
            </div>
          </div>

          <div>
            <label htmlFor="auth-password" className="mb-1 block text-xs font-medium text-[#b4b4b4]">
              {t('auth.password')}
            </label>
            <div className="relative flex items-center">
              <Lock className="pointer-events-none absolute left-3 h-4 w-4 text-[#8e8ea0]" />
              <input
                id="auth-password"
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••"
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                className="w-full rounded-xl border border-white/10 bg-[#2a2a2a] py-2 pr-3 pl-9 text-sm text-white placeholder-[#6b7280] outline-none focus:border-white/30"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="mt-1 w-full rounded-xl bg-white py-2.5 text-sm font-semibold text-[#212121] transition-colors hover:bg-[#e5e5e5] disabled:opacity-50"
          >
            {submitting
              ? mode === 'login'
                ? t('auth.signingIn')
                : t('auth.creatingAccount')
              : mode === 'login'
                ? t('common.signIn')
                : t('auth.createAccount')}
          </button>
        </form>

        {/* Seeded Admin Helper */}
        <div className="rounded-2xl border border-[#10a37f]/25 bg-[#10a37f]/10 p-3.5 text-xs">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 font-semibold text-[#6ee7b7]">
              <ShieldCheck className="h-4 w-4 shrink-0" />
              <span>{t('auth.defaultAdminCreds')}</span>
            </div>
            <button
              type="button"
              onClick={handleFillAdmin}
              className="rounded-lg bg-[#10a37f] px-2.5 py-1 text-[11px] font-semibold text-white transition-colors hover:bg-[#0d8c6d]"
            >
              {t('auth.fillAdminLogin')}
            </button>
          </div>
          <div className="mt-2 space-y-0.5 font-mono text-[11px] text-[#d1fae5]">
            <div>
              {t('auth.emailLabel')} <span className="select-all text-white">admin@ai-agent-tool.dev</span>
            </div>
            <div>
              {t('auth.passwordLabel')} <span className="select-all text-white">admin123</span>
            </div>
          </div>
        </div>

        {/* Fallback to Local Simulated Mode */}
        <div className="border-t border-white/10 pt-3 text-center">
          <button
            type="button"
            onClick={onUseSimulatedMode}
            className="text-xs text-[#8e8ea0] underline-offset-4 transition-colors hover:text-white hover:underline"
          >
            {t('auth.offlineSimulated')}
          </button>
        </div>
      </div>
    </div>
  );
}
