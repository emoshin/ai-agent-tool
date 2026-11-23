import { useEffect, useState, type FormEvent } from 'react';
import { Eye, EyeOff, KeyRound, X } from 'lucide-react';
import type { ManagedUser } from '../../types/admin';

interface SetUserPasswordModalProps {
  user: ManagedUser | null;
  onClose: () => void;
  onSetPassword: (userId: string, password: string) => Promise<void> | void;
}

export function SetUserPasswordModal({
  user,
  onClose,
  onSetPassword,
}: SetUserPasswordModalProps) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setPassword('');
    setConfirmPassword('');
    setShowPassword(false);
    setSaving(false);
    setError(null);
  }, [user?.id]);

  if (!user) return null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (password.length > 100) {
      setError('Password must be at most 100 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await onSetPassword(user.id, password);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update password.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="set-user-password-modal-title"
    >
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#212121] p-6 text-[#ececec] shadow-2xl">
        <div className="mb-5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#10a37f]/20 text-[#10a37f]">
              <KeyRound className="h-5 w-5" />
            </div>
            <div>
              <h2 id="set-user-password-modal-title" className="text-base font-semibold text-white">
                Set Password
              </h2>
              <p className="text-xs text-[#8e8ea0]">
                {user.name} ({user.email})
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-[#8e8ea0] hover:bg-white/10 hover:text-white"
            aria-label="Close set password modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
          {error && (
            <div
              data-testid="set-password-error"
              className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-200"
            >
              {error}
            </div>
          )}

          <div>
            <label
              className="mb-1 block text-xs font-medium text-[#b4b4b4]"
              htmlFor="set-user-password-input"
            >
              New Password
            </label>
            <div className="relative">
              <input
                id="set-user-password-input"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError(null);
                }}
                placeholder="Minimum 6 characters"
                autoComplete="new-password"
                className="w-full rounded-lg border border-white/10 bg-[#2a2a2a] py-2 pr-10 pl-3 text-sm text-white outline-none focus:border-white/30"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute top-1/2 right-2.5 -translate-y-1/2 rounded p-1 text-[#8e8ea0] hover:text-white"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div>
            <label
              className="mb-1 block text-xs font-medium text-[#b4b4b4]"
              htmlFor="confirm-user-password-input"
            >
              Confirm Password
            </label>
            <input
              id="confirm-user-password-input"
              type={showPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value);
                setError(null);
              }}
              placeholder="Re-enter new password"
              autoComplete="new-password"
              className="w-full rounded-lg border border-white/10 bg-[#2a2a2a] px-3 py-2 text-sm text-white outline-none focus:border-white/30"
            />
          </div>

          <div className="flex justify-end gap-2 border-t border-white/10 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="rounded-xl px-4 py-2 text-sm text-[#b4b4b4] hover:bg-white/10 hover:text-white disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-white px-4 py-2 text-sm font-medium text-[#212121] hover:bg-[#e5e5e5] disabled:opacity-50"
            >
              {saving ? 'Updating...' : 'Update password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
