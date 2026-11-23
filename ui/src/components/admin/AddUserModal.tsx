import { useState, type FormEvent } from 'react';
import { UserPlus, X } from 'lucide-react';
import { useI18n } from '../../i18n/I18nContext';
import type { CreateUserInput, UserRole } from '../../types/admin';
import { AVATAR_PRESETS } from '../../utils/defaults';

interface AddUserModalProps {
  isOpen: boolean;
  existingEmails: string[];
  onClose: () => void;
  onAddUser: (input: CreateUserInput) => void;
}

export function AddUserModal({
  isOpen,
  existingEmails,
  onClose,
  onAddUser,
}: AddUserModalProps) {
  const { t } = useI18n();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('member');
  const [tokenLimit, setTokenLimit] = useState('250000');
  const [avatarUrl, setAvatarUrl] = useState(AVATAR_PRESETS[0]);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    const trimmedEmail = email.trim().toLowerCase();

    if (!trimmedName) {
      setError(t('addUser.errName'));
      return;
    }
    if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setError(t('addUser.errEmail'));
      return;
    }
    if (existingEmails.some((em) => em.toLowerCase() === trimmedEmail)) {
      setError(t('addUser.errDuplicate'));
      return;
    }
    if (password && password.length < 6) {
      setError(t('addUser.errPassword'));
      return;
    }

    const parsedLimit = Number.parseInt(tokenLimit, 10);
    const validLimit = Number.isFinite(parsedLimit) && parsedLimit >= 1000 ? parsedLimit : 250000;

    onAddUser({
      name: trimmedName,
      email: trimmedEmail,
      ...(password ? { password } : {}),
      role,
      tokenLimit: validLimit,
      avatarUrl: avatarUrl.trim() || AVATAR_PRESETS[0],
    });
    setName('');
    setEmail('');
    setPassword('');
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-user-modal-title"
    >
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#212121] p-6 text-[#ececec] shadow-2xl">
        <div className="mb-5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#10a37f]/20 text-[#10a37f]">
              <UserPlus className="h-5 w-5" />
            </div>
            <h2 id="add-user-modal-title" className="text-lg font-semibold text-white">
              {t('addUser.title')}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-[#8e8ea0] hover:bg-white/10 hover:text-white"
            aria-label={t('addUser.closeAria')}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">
              {error}
            </div>
          )}

          <div>
            <label className="mb-1 block text-xs font-medium text-[#b4b4b4]" htmlFor="new-user-name">
              {t('addUser.fullName')}
            </label>
            <input
              id="new-user-name"
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setError(null);
              }}
              placeholder="e.g. Jordan Lee"
              className="w-full rounded-lg border border-white/10 bg-[#2a2a2a] px-3 py-2 text-sm text-white outline-none focus:border-white/30"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-[#b4b4b4]" htmlFor="new-user-email">
              {t('addUser.email')}
            </label>
            <input
              id="new-user-email"
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setError(null);
              }}
              placeholder="jordan.lee@ai-agent-tool.dev"
              className="w-full rounded-lg border border-white/10 bg-[#2a2a2a] px-3 py-2 text-sm text-white outline-none focus:border-white/30"
            />
          </div>

          <div>
            <label
              className="mb-1 block text-xs font-medium text-[#b4b4b4]"
              htmlFor="new-user-password"
            >
              {t('addUser.initialPassword')}
            </label>
            <input
              id="new-user-password"
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setError(null);
              }}
              placeholder={t('addUser.initialPasswordPlaceholder')}
              autoComplete="new-password"
              className="w-full rounded-lg border border-white/10 bg-[#2a2a2a] px-3 py-2 text-sm text-white outline-none focus:border-white/30"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-[#b4b4b4]" htmlFor="new-user-role">
                {t('addUser.role')}
              </label>
              <select
                id="new-user-role"
                value={role}
                onChange={(e) => setRole(e.target.value as UserRole)}
                className="w-full rounded-lg border border-white/10 bg-[#2a2a2a] px-3 py-2 text-sm text-white outline-none focus:border-white/30"
              >
                <option value="member">{t('addUser.role.member')}</option>
                <option value="admin">{t('addUser.role.admin')}</option>
                <option value="viewer">{t('addUser.role.viewer')}</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-[#b4b4b4]" htmlFor="new-user-quota">
                {t('addUser.quota')}
              </label>
              <input
                id="new-user-quota"
                type="number"
                min={1000}
                step={1000}
                value={tokenLimit}
                onChange={(e) => setTokenLimit(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-[#2a2a2a] px-3 py-2 text-sm text-white outline-none focus:border-white/30"
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-[#b4b4b4]">
              {t('addUser.avatar')}
            </label>
            <div className="mb-2 flex items-center gap-2">
              {AVATAR_PRESETS.map((preset, idx) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setAvatarUrl(preset)}
                  className={[
                    'rounded-full p-0.5 transition-transform hover:scale-105',
                    avatarUrl === preset ? 'ring-2 ring-[#10a37f]' : 'opacity-75',
                  ].join(' ')}
                  aria-label={t('addUser.selectAvatarAria', { index: idx + 1 })}
                >
                  <img src={preset} alt={t('settings.presetAvatarAlt', { index: idx + 1 })} className="h-8 w-8 rounded-full" />
                </button>
              ))}
            </div>
          </div>

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
              {t('addUser.submit')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
