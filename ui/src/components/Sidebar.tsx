import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  LogIn,
  LogOut,
  PanelLeftClose,
  Pencil,
  Search,
  Settings,
  Shield,
  SquarePen,
  Trash2,
  X,
} from 'lucide-react';
import type { BotAdapterMode, ChatSession, UserProfile } from '../types/chat';
import { useI18n, type TranslationKey } from '../i18n/I18nContext';
import { groupChatsByDate } from '../utils/storage';
import { ModelIcon } from './ModelIcon';

interface SidebarProps {
  chats: ChatSession[];
  activeChatId: string | null;
  isCollapsed: boolean;
  isMobileOpen: boolean;
  userProfile: UserProfile;
  botMode: BotAdapterMode;
  isAuthenticated?: boolean;
  isAdmin?: boolean;
  onToggleCollapse: () => void;
  onCloseMobile: () => void;
  onNewChat: () => void;
  onSelectChat: (chatId: string) => void;
  onRenameChat: (chatId: string, newTitle: string) => void;
  onDeleteChat: (chatId: string) => void;
  onOpenSettings: () => void;
  onOpenAdmin: () => void;
  onOpenAuth?: () => void;
  onLogout?: () => void;
}

export function Sidebar({
  chats,
  activeChatId,
  isCollapsed,
  isMobileOpen,
  userProfile,
  botMode,
  isAuthenticated = false,
  isAdmin = true,
  onToggleCollapse,
  onCloseMobile,
  onNewChat,
  onSelectChat,
  onRenameChat,
  onDeleteChat,
  onOpenSettings,
  onOpenAdmin,
  onOpenAuth,
  onLogout,
}: SidebarProps) {
  const { t } = useI18n();
  const [searchQuery, setSearchQuery] = useState('');
  const [editingChatId, setEditingChatId] = useState<string | null>(null);
  const [editTitleValue, setEditTitleValue] = useState('');
  const [avatarError, setAvatarError] = useState(false);
  const editInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setAvatarError(false);
  }, [userProfile.avatarUrl]);

  useEffect(() => {
    if (editingChatId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingChatId]);

  const filteredChats = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return chats;
    return chats.filter(
      (chat) =>
        chat.title.toLowerCase().includes(q) ||
        chat.messages.some((m) => m.content.toLowerCase().includes(q))
    );
  }, [chats, searchQuery]);

  const groupedChats = useMemo(() => groupChatsByDate(filteredChats), [filteredChats]);

  const startRename = (chat: ChatSession) => {
    setEditingChatId(chat.id);
    setEditTitleValue(chat.title);
  };

  const commitRename = () => {
    if (editingChatId && editTitleValue.trim()) {
      onRenameChat(editingChatId, editTitleValue.trim());
    }
    setEditingChatId(null);
    setEditTitleValue('');
  };

  const cancelRename = () => {
    setEditingChatId(null);
    setEditTitleValue('');
  };

  const initials = userProfile.name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');

  return (
    <>
      {/* Mobile backdrop */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/60 backdrop-blur-[1px] md:hidden"
          onClick={onCloseMobile}
          aria-hidden="true"
        />
      )}

      <aside
        aria-label={t('sidebar.aria')}
        data-collapsed={isCollapsed ? 'true' : 'false'}
        className={[
          'fixed inset-y-0 left-0 z-40 flex h-full flex-col bg-[#171717] text-[#ececec] transition-all duration-200 ease-in-out md:static md:z-auto',
          isMobileOpen ? 'translate-x-0 w-[260px]' : '-translate-x-full md:translate-x-0',
          isCollapsed ? 'md:w-0 md:overflow-hidden md:border-r-0' : 'md:w-[260px] md:border-r md:border-white/10',
        ].join(' ')}
      >
        <div className="flex h-full w-[260px] flex-col">
          {/* Sidebar Top Actions */}
          <div className="flex items-center justify-between px-3 pt-3 pb-2">
            <button
              type="button"
              onClick={() => {
                onToggleCollapse();
                onCloseMobile();
              }}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-[#b4b4b4] transition-colors hover:bg-[#2f2f2f] hover:text-white"
              title={t('sidebar.collapse')}
              aria-label={t('sidebar.collapse')}
            >
              <PanelLeftClose className="h-5 w-5" />
            </button>

            <button
              type="button"
              onClick={() => {
                onNewChat();
                onCloseMobile();
              }}
              className="inline-flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm font-medium text-[#ececec] transition-colors hover:bg-[#2f2f2f]"
              title={t('sidebar.newChat')}
              aria-label={t('sidebar.newChat')}
            >
              <SquarePen className="h-4 w-4" />
              <span>{t('sidebar.newChat')}</span>
            </button>
          </div>

          {/* Search box */}
          <div className="px-3 pb-2">
            <div className="relative flex items-center">
              <Search className="pointer-events-none absolute left-2.5 h-3.5 w-3.5 text-[#8e8ea0]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('sidebar.searchPlaceholder')}
                aria-label={t('sidebar.searchAria')}
                className="w-full rounded-lg border border-white/10 bg-[#212121] py-1.5 pr-7 pl-8 text-xs text-[#ececec] placeholder-[#8e8ea0] outline-none transition-colors focus:border-white/25"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 text-[#8e8ea0] hover:text-white"
                  aria-label={t('sidebar.clearSearch')}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Chat History List */}
          <nav className="flex-1 overflow-y-auto px-2 py-1" aria-label={t('sidebar.chatHistoryAria')}>
            {groupedChats.length === 0 ? (
              <div className="px-3 py-6 text-center text-xs text-[#8e8ea0]">
                {searchQuery ? t('sidebar.noMatchingChats') : t('sidebar.noConversations')}
              </div>
            ) : (
              groupedChats.map((group) => (
                <div key={group.label} className="mb-4">
                  <div className="px-2.5 py-1.5 text-[11px] font-semibold tracking-wide text-[#8e8ea0] uppercase">
                    {t(`dateGroup.${group.label}` as TranslationKey)}
                  </div>
                  <ul className="space-y-0.5">
                    {group.chats.map((chat) => {
                      const isActive = chat.id === activeChatId;
                      const isEditing = editingChatId === chat.id;

                      return (
                        <li key={chat.id} className="group relative">
                          {isEditing ? (
                            <div className="flex items-center gap-1 rounded-lg bg-[#2f2f2f] px-2 py-1.5">
                                <input
                                  ref={editInputRef}
                                  type="text"
                                  value={editTitleValue}
                                  onChange={(e) => setEditTitleValue(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') commitRename();
                                    if (e.key === 'Escape') cancelRename();
                                  }}
                                  onBlur={commitRename}
                                  aria-label={t('sidebar.renameTitleAria')}
                                  className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none"
                                />
                                <button
                                  type="button"
                                  onMouseDown={(e) => e.preventDefault()}
                                  onClick={commitRename}
                                  className="rounded p-0.5 text-[#10a37f] hover:bg-white/10"
                                  aria-label={t('sidebar.saveTitleAria')}
                                >
                                  <Check className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            ) : (
                              <div
                                className={[
                                  'flex items-center rounded-lg transition-colors',
                                  isActive
                                    ? 'bg-[#2f2f2f] text-white'
                                    : 'text-[#d1d5db] hover:bg-[#242424] hover:text-white',
                                ].join(' ')}
                              >
                                <button
                                  type="button"
                                  onClick={() => {
                                    onSelectChat(chat.id);
                                    onCloseMobile();
                                  }}
                                  className="flex min-w-0 flex-1 items-center gap-2.5 px-2.5 py-2 text-left text-sm"
                                  title={chat.title}
                                >
                                  <ModelIcon modelId={chat.model} className="h-4 w-4 shrink-0" />
                                  <span className="truncate">{chat.title}</span>
                                </button>

                                <div
                                  className={[
                                    'flex items-center gap-0.5 pr-1.5 transition-opacity',
                                    isActive
                                      ? 'opacity-100'
                                      : 'opacity-0 group-hover:opacity-100 focus-within:opacity-100',
                                  ].join(' ')}
                                >
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      startRename(chat);
                                    }}
                                    className="rounded p-1 text-[#8e8ea0] hover:bg-white/10 hover:text-white"
                                    title={t('sidebar.renameChat')}
                                    aria-label={t('sidebar.renameChatAria', { title: chat.title })}
                                  >
                                    <Pencil className="h-3.5 w-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onDeleteChat(chat.id);
                                    }}
                                    className="rounded p-1 text-[#8e8ea0] hover:bg-white/10 hover:text-red-400"
                                    title={t('sidebar.deleteChat')}
                                    aria-label={t('sidebar.deleteChatAria', { title: chat.title })}
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              </div>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))
              )}
          </nav>

          {/* Bottom User Profile & Settings */}
          <div className="border-t border-white/10 p-2.5">
            <div className="flex items-center justify-between gap-2 rounded-xl px-2 py-2 transition-colors hover:bg-[#242424]">
              <div className="flex min-w-0 items-center gap-2.5">
                {userProfile.avatarUrl && !avatarError ? (
                  <img
                    src={userProfile.avatarUrl}
                    alt={t('sidebar.avatarAlt', { name: userProfile.name })}
                    onError={() => setAvatarError(true)}
                    className="h-9 w-9 shrink-0 rounded-full border border-white/15 object-cover"
                  />
                ) : (
                  <div
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#10a37f] text-xs font-semibold text-white"
                    aria-label={t('sidebar.avatarAlt', { name: userProfile.name })}
                  >
                    {initials || 'U'}
                  </div>
                )}
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-[#ececec]">
                    {userProfile.name}
                  </div>
                  <div className="flex items-center gap-1.5 truncate text-[11px] text-[#8e8ea0]">
                    <span
                      className={[
                        'inline-block h-1.5 w-1.5 rounded-full',
                        botMode === 'api' ? 'bg-sky-400' : 'bg-[#10a37f]',
                      ].join(' ')}
                    />
                    <span className="truncate">{userProfile.subtitle}</span>
                  </div>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-0.5">
                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => {
                      onOpenAdmin();
                      onCloseMobile();
                    }}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[#b4b4b4] transition-colors hover:bg-white/10 hover:text-white"
                    title={t('sidebar.adminConsoleTitle')}
                    aria-label={t('sidebar.adminConsoleAria')}
                  >
                    <Shield className="h-4 w-4" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={onOpenSettings}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[#b4b4b4] transition-colors hover:bg-white/10 hover:text-white"
                  title={t('sidebar.settingsTitle')}
                  aria-label={t('sidebar.settingsAria')}
                >
                  <Settings className="h-4 w-4" />
                </button>
                {isAuthenticated && onLogout ? (
                  <button
                    type="button"
                    onClick={() => {
                      onLogout();
                      onCloseMobile();
                    }}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[#b4b4b4] transition-colors hover:bg-white/10 hover:text-red-300"
                    title={t('sidebar.signOutTitle')}
                    aria-label={t('sidebar.signOutAria')}
                  >
                    <LogOut className="h-4 w-4" />
                  </button>
                ) : (
                  onOpenAuth && (
                    <button
                      type="button"
                      onClick={() => {
                        onOpenAuth();
                        onCloseMobile();
                      }}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[#b4b4b4] transition-colors hover:bg-white/10 hover:text-white"
                      title={t('sidebar.signInTitle')}
                      aria-label={t('sidebar.signInAria')}
                    >
                      <LogIn className="h-4 w-4" />
                    </button>
                  )
                )}
              </div>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
