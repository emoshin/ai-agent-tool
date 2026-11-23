import { useEffect, useMemo, useState } from 'react';
import {
  Cpu,
  DollarSign,
  Download,
  MessageSquare,
  Search,
  Trash2,
  User as UserIcon,
  X,
} from 'lucide-react';
import { useI18n } from '../../i18n/I18nContext';
import type { ManagedUser } from '../../types/admin';
import type { ChatSession } from '../../types/chat';
import { getModelDisplayName } from '../../utils/defaults';
import {
  computeChatTokenBreakdown,
  estimateModelCostUsd,
  estimateUserCostBreakdown,
  formatTokenCount,
  formatUsd,
  getMessageTokens,
} from '../../utils/tokens';
import { MarkdownRenderer } from '../MarkdownRenderer';
import { ModelIcon } from '../ModelIcon';

interface UserChatsModalProps {
  user: ManagedUser | null;
  onClose: () => void;
  onDeleteUserChat?: (userId: string, chatId: string) => void;
  onBackupChat?: (user: ManagedUser, chat: ChatSession) => Promise<string> | void;
  onBackupUserChats?: (user: ManagedUser) => Promise<string> | void;
}

export function UserChatsModal({
  user,
  onClose,
  onDeleteUserChat,
  onBackupChat,
  onBackupUserChats,
}: UserChatsModalProps) {
  const { t, dateLocale } = useI18n();
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [backupBusy, setBackupBusy] = useState(false);
  const [backupStatus, setBackupStatus] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  useEffect(() => {
    setSelectedChatId(user?.chats[0]?.id ?? null);
    setSearch('');
    setBackupStatus(null);
  }, [user?.id]);

  const filteredChats = useMemo(() => {
    if (!user) return [];
    const q = search.trim().toLowerCase();
    if (!q) return user.chats;
    return user.chats.filter(
      (chat) =>
        chat.title.toLowerCase().includes(q) ||
        chat.messages.some((m) => m.content.toLowerCase().includes(q))
    );
  }, [user, search]);

  useEffect(() => {
    if (!filteredChats.some((c) => c.id === selectedChatId)) {
      setSelectedChatId(filteredChats[0]?.id ?? null);
    }
  }, [filteredChats, selectedChatId]);

  if (!user) return null;

  const userSpend = estimateUserCostBreakdown(user);
  const deletedChatsCount = user.chats.filter((c) => c.deletedByUser).length;
  const selectedChat = filteredChats.find((c) => c.id === selectedChatId) ?? null;
  const selectedBreakdown = selectedChat ? computeChatTokenBreakdown(selectedChat) : null;
  const selectedChatCostUsd =
    selectedChat && selectedBreakdown
      ? estimateModelCostUsd(
          selectedChat.model,
          selectedBreakdown.promptTokens,
          selectedBreakdown.completionTokens
        )
      : 0;

  const handleBackupSingle = async (chat: ChatSession) => {
    if (!onBackupChat) return;
    setBackupBusy(true);
    setBackupStatus(null);
    try {
      const result = await onBackupChat(user, chat);
      setBackupStatus({
        type: 'success',
        message: result || t('userChats.backupSingleFallback', { title: chat.title }),
      });
    } catch (err) {
      setBackupStatus({
        type: 'error',
        message: err instanceof Error ? err.message : t('userChats.backupSingleErr'),
      });
    } finally {
      setBackupBusy(false);
    }
  };

  const handleBackupAllForUser = async () => {
    if (!onBackupUserChats) return;
    setBackupBusy(true);
    setBackupStatus(null);
    try {
      const result = await onBackupUserChats(user);
      setBackupStatus({
        type: 'success',
        message:
          result ||
          t('userChats.backupUserFallback', {
            count: user.chats.length,
            name: user.name,
          }),
      });
    } catch (err) {
      setBackupStatus({
        type: 'error',
        message: err instanceof Error ? err.message : t('userChats.backupUserErr'),
      });
    } finally {
      setBackupBusy(false);
    }
  };

  const deletedPart =
    deletedChatsCount > 0 ? t('userChats.deletedPart', { count: deletedChatsCount }) : '';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="user-chats-modal-title"
    >
      <div className="flex h-[85vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#1b1b1b] text-[#ececec] shadow-2xl">
        {/* Modal Header */}
        <div className="flex items-center justify-between gap-3 border-b border-white/10 bg-[#171717] px-5 py-4">
          <div className="flex min-w-0 items-center gap-3">
            <img
              src={user.avatarUrl}
              alt={t('sidebar.avatarAlt', { name: user.name })}
              className="h-10 w-10 rounded-full border border-white/15 object-cover"
            />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 id="user-chats-modal-title" className="truncate text-base font-semibold text-white">
                  {t('userChats.title', { name: user.name })}
                </h2>
                <span
                  className={[
                    'rounded-full px-2 py-0.5 text-[11px] font-medium capitalize',
                    user.status === 'active'
                      ? 'bg-[#10a37f]/20 text-[#10a37f]'
                      : 'bg-amber-500/20 text-amber-300',
                  ].join(' ')}
                >
                  {user.status === 'active' ? t('admin.user.active') : t('admin.user.suspended')}
                </span>
              </div>
              <p className="truncate text-xs text-[#8e8ea0]">
                {t('userChats.summary', {
                  email: user.email,
                  count: user.chats.length,
                  deletedPart,
                  tokens: formatTokenCount(user.tokenUsage.totalTokens),
                  cost: formatUsd(userSpend.totalUsd),
                })}
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {onBackupUserChats && user.chats.length > 0 && (
              <button
                type="button"
                onClick={() => void handleBackupAllForUser()}
                disabled={backupBusy}
                aria-label={t('userChats.backupAllAria', { name: user.name })}
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-[#242424] px-3 py-1.5 text-xs font-medium text-[#ececec] transition-colors hover:bg-[#2f2f2f] disabled:opacity-50"
              >
                <Download className="h-3.5 w-3.5 text-[#10a37f]" />
                <span>{t('userChats.backupAll')}</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-[#8e8ea0] hover:bg-white/10 hover:text-white"
              aria-label={t('userChats.closeAria')}
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {backupStatus && (
          <div
            data-testid="modal-backup-status"
            className={[
              'flex items-center justify-between border-b px-5 py-2 text-xs',
              backupStatus.type === 'success'
                ? 'border-[#10a37f]/30 bg-[#10a37f]/10 text-emerald-100'
                : 'border-red-500/30 bg-red-500/10 text-red-200',
            ].join(' ')}
          >
            <span>{backupStatus.message}</span>
            <button
              type="button"
              onClick={() => setBackupStatus(null)}
              className="ml-3 text-[#8e8ea0] hover:text-white"
            >
              {t('common.dismiss')}
            </button>
          </div>
        )}

        {/* Split Pane Body */}
        <div className="flex min-h-0 flex-1 flex-col md:flex-row">
          {/* Left: User's Chat List */}
          <div className="flex w-full shrink-0 flex-col border-b border-white/10 bg-[#171717] md:w-72 md:border-r md:border-b-0">
            <div className="p-3">
              <div className="relative flex items-center">
                <Search className="pointer-events-none absolute left-2.5 h-3.5 w-3.5 text-[#8e8ea0]" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t('userChats.filterPlaceholder')}
                  aria-label={t('userChats.filterAria')}
                  className="w-full rounded-lg border border-white/10 bg-[#212121] py-1.5 pr-3 pl-8 text-xs text-[#ececec] placeholder-[#8e8ea0] outline-none focus:border-white/25"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-2 pb-3">
              {filteredChats.length === 0 ? (
                <div className="px-3 py-8 text-center text-xs text-[#8e8ea0]">
                  {t('userChats.noChats')}
                </div>
              ) : (
                <ul className="space-y-1">
                  {filteredChats.map((chat) => {
                    const isSelected = chat.id === selectedChat?.id;
                    const tokens = computeChatTokenBreakdown(chat);
                    return (
                      <li key={chat.id} className="group flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setSelectedChatId(chat.id)}
                          className={[
                            'flex min-w-0 flex-1 flex-col rounded-xl px-3 py-2.5 text-left transition-colors',
                            isSelected
                              ? 'bg-[#2f2f2f] text-white'
                              : 'text-[#d1d5db] hover:bg-[#242424]',
                            chat.deletedByUser ? 'border border-rose-500/25' : '',
                          ].join(' ')}
                        >
                          <div className="flex items-center gap-2">
                            <ModelIcon modelId={chat.model} className="h-3.5 w-3.5 shrink-0" />
                            <span className="min-w-0 flex-1 truncate text-sm font-medium">
                              {chat.title}
                            </span>
                            {chat.deletedByUser && (
                              <span
                                data-testid={`admin-chat-deleted-icon-${chat.id}`}
                                title={t('userChats.deletedByUser')}
                                aria-label={t('userChats.deletedByUser')}
                                className="inline-flex shrink-0 items-center text-rose-400"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </span>
                            )}
                          </div>
                          <div className="mt-1 flex items-center justify-between text-[11px] text-[#8e8ea0]">
                            <span>
                              {t('userChats.msgsCount', { count: chat.messages.length })}
                              {chat.deletedByUser ? t('userChats.deletedTag') : ''}
                            </span>
                            <span>{t('userChats.tokShort', { tokens: formatTokenCount(tokens.totalTokens) })}</span>
                          </div>
                        </button>

                        {onBackupChat && (
                          <button
                            type="button"
                            onClick={() => void handleBackupSingle(chat)}
                            disabled={backupBusy}
                            className="rounded-lg p-1.5 text-[#8e8ea0] opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100 hover:bg-white/10 hover:text-[#10a37f] disabled:opacity-40"
                            title={t('userChats.backupChatTitle')}
                            aria-label={t('userChats.backupChatAria', { title: chat.title })}
                          >
                            <Download className="h-3.5 w-3.5" />
                          </button>
                        )}

                        {onDeleteUserChat && (
                          <button
                            type="button"
                            onClick={() => onDeleteUserChat(user.id, chat.id)}
                            className="rounded-lg p-1.5 text-[#8e8ea0] opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100 hover:bg-white/10 hover:text-red-400"
                            title={t('userChats.deleteChatTitle')}
                            aria-label={t('userChats.deleteChatAria', { title: chat.title })}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>

          {/* Right: Selected Chat Transcript */}
          <div className="flex min-w-0 flex-1 flex-col bg-[#212121]">
            {selectedChat ? (
              <>
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 px-5 py-3 text-xs text-[#b4b4b4]">
                  <div className="flex flex-wrap items-center gap-2 font-medium text-white">
                    <ModelIcon modelId={selectedChat.model} className="h-4 w-4 shrink-0" />
                    <span>{selectedChat.title}</span>
                    <span className="rounded-md bg-white/10 px-2 py-0.5 text-[11px] text-[#d1d5db]">
                      {getModelDisplayName(selectedChat.model)}
                    </span>
                    {selectedChat.deletedByUser && (
                      <span
                        data-testid={`selected-chat-deleted-badge-${selectedChat.id}`}
                        className="inline-flex items-center gap-1 rounded-md border border-rose-500/30 bg-rose-500/15 px-2 py-0.5 text-[11px] font-medium text-rose-300"
                      >
                        <Trash2 className="h-3 w-3" />
                        <span>
                          {t('userChats.deletedByUser')}
                          {selectedChat.deletedAt
                            ? ` · ${new Date(selectedChat.deletedAt).toLocaleString(dateLocale)}`
                            : ''}
                        </span>
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-3 text-[11px] text-[#8e8ea0]">
                    {selectedBreakdown && (
                      <>
                        <span className="inline-flex items-center gap-1">
                          <Cpu className="h-3.5 w-3.5 text-[#10a37f]" />
                          {t('userChats.promptTokens', {
                            count: selectedBreakdown.promptTokens.toLocaleString(dateLocale),
                          })}
                        </span>
                        <span>
                          {t('userChats.completionTokens', {
                            count: selectedBreakdown.completionTokens.toLocaleString(dateLocale),
                          })}
                        </span>
                        <span className="font-medium text-[#ececec]">
                          {t('userChats.totalTokens', {
                            count: selectedBreakdown.totalTokens.toLocaleString(dateLocale),
                          })}
                        </span>
                        <span className="inline-flex items-center gap-0.5 font-medium text-emerald-400">
                          <DollarSign className="h-3 w-3" />
                          {t('userChats.estCost', { cost: formatUsd(selectedChatCostUsd) })}
                        </span>
                      </>
                    )}

                    {onBackupChat && (
                      <button
                        type="button"
                        onClick={() => void handleBackupSingle(selectedChat)}
                        disabled={backupBusy}
                        aria-label={t('userChats.backupSelectedAria', { title: selectedChat.title })}
                        className="inline-flex items-center gap-1 rounded-lg border border-white/15 bg-[#171717] px-2.5 py-1 text-[11px] font-medium text-[#ececec] transition-colors hover:bg-[#2a2a2a] disabled:opacity-50"
                      >
                        <Download className="h-3 w-3 text-[#10a37f]" />
                        <span>{t('userChats.backupChatBtn')}</span>
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex-1 space-y-4 overflow-y-auto p-5">
                  {selectedChat.messages.length === 0 ? (
                    <div className="py-12 text-center text-sm text-[#8e8ea0]">
                      {t('userChats.noMessages')}
                    </div>
                  ) : (
                    selectedChat.messages.map((msg) => {
                      const isUser = msg.role === 'user';
                      const tokens = getMessageTokens(msg);
                      return (
                        <div
                          key={msg.id}
                          className={[
                            'rounded-2xl border p-4',
                            isUser
                              ? 'border-white/10 bg-[#2a2a2a]'
                              : 'border-white/5 bg-[#1a1a1a]',
                          ].join(' ')}
                        >
                          <div className="mb-2 flex items-center justify-between text-xs text-[#8e8ea0]">
                            <div className="flex items-center gap-2 font-medium text-[#ececec]">
                              {isUser ? (
                                <UserIcon className="h-3.5 w-3.5 text-sky-400" />
                              ) : (
                                <ModelIcon modelId={selectedChat.model} className="h-3.5 w-3.5" />
                              )}
                              <span>{isUser ? user.name : getModelDisplayName(selectedChat.model)}</span>
                            </div>
                            <div className="flex items-center gap-3">
                              <span>
                                {t('userChats.tokensCount', {
                                  count: tokens.toLocaleString(dateLocale),
                                })}
                              </span>
                              <span>{new Date(msg.createdAt).toLocaleString(dateLocale)}</span>
                            </div>
                          </div>

                          {isUser ? (
                            <p className="text-sm leading-relaxed whitespace-pre-wrap text-[#ececec]">
                              {msg.content}
                            </p>
                          ) : (
                            <MarkdownRenderer content={msg.content} />
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </>
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center p-8 text-center text-sm text-[#8e8ea0]">
                <MessageSquare className="mb-2 h-8 w-8 opacity-40" />
                <p>{t('userChats.emptySelection')}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
