import { useState, type FormEvent } from 'react';
import { X } from 'lucide-react';
import { useI18n } from '../i18n/I18nContext';
import type { BotSettings, UserProfile } from '../types/chat';
import { AVATAR_PRESETS } from '../utils/defaults';
import { LanguageSwitcher } from './LanguageSwitcher';

interface SettingsModalProps {
  isOpen: boolean;
  botSettings: BotSettings;
  userProfile: UserProfile;
  authEmail?: string | null;
  authRole?: string | null;
  onClose: () => void;
  onOpenAuth?: () => void;
  onLogout?: () => void;
  onSave: (nextSettings: BotSettings, nextProfile: UserProfile, newPassword?: string) => void;
}

export function SettingsModal({
  isOpen,
  botSettings,
  userProfile,
  authEmail = null,
  authRole = null,
  onClose,
  onOpenAuth,
  onLogout,
  onSave,
}: SettingsModalProps) {
  const { t } = useI18n();
  const [settings, setSettings] = useState<BotSettings>(botSettings);
  const [profile, setProfile] = useState<UserProfile>(userProfile);
  const [newPassword, setNewPassword] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    onSave(
      {
        ...settings,
        apiEndpoint: settings.apiEndpoint.trim() || '/api/chat',
      },
      {
        name: profile.name.trim() || 'User',
        subtitle: profile.subtitle.trim() || 'Workspace Member',
        avatarUrl: profile.avatarUrl.trim() || AVATAR_PRESETS[0],
      },
      newPassword.trim() || undefined
    );
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-3 backdrop-blur-xs sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-modal-title"
    >
      <div className="max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-2xl border border-white/10 bg-[#212121] p-4 text-[#ececec] shadow-2xl sm:p-6">
        <div className="mb-4 flex items-center justify-between sm:mb-5">
          <h2 id="settings-modal-title" className="text-base font-semibold text-white sm:text-lg">
            {t('settings.title')}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-[#8e8ea0] hover:bg-white/10 hover:text-white"
            aria-label={t('settings.closeAria')}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 sm:space-y-6">
          {/* Language */}
          <section className="flex flex-col items-start justify-between gap-3 rounded-xl border border-white/10 bg-[#1a1a1a] px-3.5 py-3 sm:flex-row sm:items-center">
            <div>
              <h3 className="text-xs font-semibold tracking-wider text-[#ececec] uppercase">
                {t('settings.languageSection')}
              </h3>
              <p className="mt-0.5 text-[11px] text-[#8e8ea0]">{t('settings.languageHint')}</p>
            </div>
            <LanguageSwitcher compact={false} />
          </section>

          {/* AI Bot Connection */}
          <section className="space-y-3">
            <h3 className="text-xs font-semibold tracking-wider text-[#8e8ea0] uppercase">
              {t('settings.adapterSection')}
            </h3>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setSettings((s) => ({ ...s, mode: 'simulated' }))}
                className={[
                  'rounded-xl border px-3 py-2.5 text-left text-sm transition-colors',
                  settings.mode === 'simulated'
                    ? 'border-[#10a37f] bg-[#10a37f]/15 text-white'
                    : 'border-white/10 bg-[#2a2a2a] text-[#b4b4b4] hover:border-white/20',
                ].join(' ')}
              >
                <div className="font-medium">{t('chat.modeSimulated')}</div>
                <div className="mt-0.5 text-xs text-[#8e8ea0]">{t('settings.simulatedDesc')}</div>
              </button>

              <button
                type="button"
                onClick={() => setSettings((s) => ({ ...s, mode: 'api' }))}
                className={[
                  'rounded-xl border px-3 py-2.5 text-left text-sm transition-colors',
                  settings.mode === 'api'
                    ? 'border-sky-400 bg-sky-400/15 text-white'
                    : 'border-white/10 bg-[#2a2a2a] text-[#b4b4b4] hover:border-white/20',
                ].join(' ')}
              >
                <div className="font-medium">{t('chat.modeApi')}</div>
                <div className="mt-0.5 text-xs text-[#8e8ea0]">{t('settings.apiDesc')}</div>
              </button>
            </div>

            {settings.mode === 'api' && (
              <div className="space-y-3 rounded-xl border border-white/10 bg-[#1a1a1a] p-3.5">
                <div className="flex items-center justify-between gap-2 rounded-lg border border-white/10 bg-[#232323] px-3 py-2 text-xs">
                  {authEmail ? (
                    <>
                      <span className="truncate text-[#d1fae5]">
                        {t('settings.signedInLabel')} <strong className="text-white">{authEmail}</strong> ({authRole})
                      </span>
                      {onLogout && (
                        <button
                          type="button"
                          onClick={() => {
                            onClose();
                            onLogout();
                          }}
                          className="shrink-0 rounded-md bg-white/10 px-2 py-1 text-[11px] font-medium text-white hover:bg-white/20"
                        >
                          {t('common.signOut')}
                        </button>
                      )}
                    </>
                  ) : (
                    <>
                      <span className="text-amber-200">{t('settings.signInRequired')}</span>
                      {onOpenAuth && (
                        <button
                          type="button"
                          onClick={() => {
                            onClose();
                            onOpenAuth();
                          }}
                          className="shrink-0 rounded-md bg-sky-500 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-sky-400"
                        >
                          {t('common.signIn')}
                        </button>
                      )}
                    </>
                  )}
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-[#b4b4b4]" htmlFor="api-endpoint">
                    {t('settings.endpointLabel')}
                  </label>
                  <input
                    id="api-endpoint"
                    type="text"
                    value={settings.apiEndpoint}
                    onChange={(e) => setSettings((s) => ({ ...s, apiEndpoint: e.target.value }))}
                    placeholder="/api/chat"
                    className="w-full rounded-lg border border-white/10 bg-[#2a2a2a] px-3 py-2 text-sm text-white outline-none focus:border-white/30"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-[#b4b4b4]" htmlFor="api-key">
                    {t('settings.jwtLabel')}
                  </label>
                  <input
                    id="api-key"
                    type="password"
                    value={settings.apiKey}
                    onChange={(e) => setSettings((s) => ({ ...s, apiKey: e.target.value }))}
                    placeholder={t('settings.jwtPlaceholder')}
                    className="w-full rounded-lg border border-white/10 bg-[#2a2a2a] px-3 py-2 text-sm text-white outline-none focus:border-white/30"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="mb-1 block text-xs font-medium text-[#b4b4b4]" htmlFor="system-prompt">
                {t('settings.systemPromptLabel')}
              </label>
              <textarea
                id="system-prompt"
                rows={2}
                value={settings.systemPrompt}
                onChange={(e) => setSettings((s) => ({ ...s, systemPrompt: e.target.value }))}
                className="w-full rounded-lg border border-white/10 bg-[#2a2a2a] px-3 py-2 text-sm text-white outline-none focus:border-white/30"
              />
            </div>
          </section>

          {/* User Profile */}
          <section className="space-y-3 border-t border-white/10 pt-4">
            <h3 className="text-xs font-semibold tracking-wider text-[#8e8ea0] uppercase">
              {t('settings.profileSection')}
            </h3>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-[#b4b4b4]" htmlFor="user-name">
                  {t('settings.displayName')}
                </label>
                <input
                  id="user-name"
                  type="text"
                  value={profile.name}
                  onChange={(e) => setProfile((p) => ({ ...p, name: e.target.value }))}
                  className="w-full rounded-lg border border-white/10 bg-[#2a2a2a] px-3 py-2 text-sm text-white outline-none focus:border-white/30"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-[#b4b4b4]" htmlFor="user-subtitle">
                  {t('settings.subtitleRole')}
                </label>
                <input
                  id="user-subtitle"
                  type="text"
                  value={profile.subtitle}
                  onChange={(e) => setProfile((p) => ({ ...p, subtitle: e.target.value }))}
                  className="w-full rounded-lg border border-white/10 bg-[#2a2a2a] px-3 py-2 text-sm text-white outline-none focus:border-white/30"
                />
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-[#b4b4b4]" htmlFor="avatar-url">
                {t('settings.avatarUrlLabel')}
              </label>
              <div className="mb-2 flex items-center gap-2">
                {AVATAR_PRESETS.map((preset, idx) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setProfile((p) => ({ ...p, avatarUrl: preset }))}
                    className={[
                      'rounded-full p-0.5 transition-transform hover:scale-105',
                      profile.avatarUrl === preset ? 'ring-2 ring-[#10a37f]' : 'opacity-75',
                    ].join(' ')}
                    aria-label={t('settings.selectPresetAvatar', { index: idx + 1 })}
                  >
                    <img
                      src={preset}
                      alt={t('settings.presetAvatarAlt', { index: idx + 1 })}
                      className="h-9 w-9 rounded-full"
                    />
                  </button>
                ))}
              </div>
              <input
                id="avatar-url"
                type="text"
                value={profile.avatarUrl}
                onChange={(e) => setProfile((p) => ({ ...p, avatarUrl: e.target.value }))}
                placeholder="https://example.com/avatar.png"
                className="w-full rounded-lg border border-white/10 bg-[#2a2a2a] px-3 py-2 text-xs text-white outline-none focus:border-white/30"
              />
            </div>

            {authEmail && (
              <div>
                <label className="mb-1 block text-xs font-medium text-[#b4b4b4]" htmlFor="new-password">
                  {t('settings.newPasswordOptional')}
                </label>
                <input
                  id="new-password"
                  type="password"
                  minLength={6}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder={t('settings.newPasswordPlaceholder')}
                  className="w-full rounded-lg border border-white/10 bg-[#2a2a2a] px-3 py-2 text-xs text-white outline-none focus:border-white/30"
                />
              </div>
            )}
          </section>

          <div className="flex justify-end gap-2 border-t border-white/10 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl px-4 py-2 text-sm text-[#b4b4b4] hover:bg-white/10 hover:text-white"
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              className="rounded-xl bg-white px-4 py-2 text-sm font-medium text-[#212121] hover:bg-[#e5e5e5]"
            >
              {t('common.saveChanges')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
