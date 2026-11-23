import { useMemo, useState } from 'react';
import {
  Activity,
  ArrowLeft,
  Ban,
  CheckCircle2,
  Cpu,
  DollarSign,
  Download,
  ExternalLink,
  Info,
  KeyRound,
  MessageSquare,
  RefreshCw,
  Search,
  Shield,
  Trash2,
  UserPlus,
  Users,
} from 'lucide-react';
import {
  backupAdminChat,
  backupAdminUserChats,
  backupAllAdminChats,
  fetchOpenAiOrgCosts,
  setAdminUserPassword,
} from '../../services/backendApiService';
import type {
  AgentProvider,
  ChatBackupPayload,
  CreateUserInput,
  ManagedUser,
  OpenAiOrgCostsResponse,
  ProviderTokenConfig,
  ProviderTokenSubmission,
  UserStatus,
  WorkspaceChatsBackupPayload,
} from '../../types/admin';
import type { BotAdapterMode, ChatSession } from '../../types/chat';
import {
  buildChatBackupPayload,
  buildUserChatsBackupPayload,
  buildWorkspaceChatsBackupPayload,
  downloadJsonBackup,
} from '../../utils/chatBackup';
import { estimateUserCostBreakdown, formatTokenCount, formatUsd } from '../../utils/tokens';
import { AddUserModal } from './AddUserModal';
import { ProviderTokensTab } from './ProviderTokensTab';
import { SetUserPasswordModal } from './SetUserPasswordModal';
import { UserChatsModal } from './UserChatsModal';

type AdminTab = 'users' | 'tokens';

interface AdminPageProps {
  users: ManagedUser[];
  providerTokens: ProviderTokenConfig[];
  botMode: BotAdapterMode;
  authToken?: string;
  onCheckOpenAiCosts?: (adminApiKey?: string) => Promise<OpenAiOrgCostsResponse>;
  onBackToChat: () => void;
  onAddUser: (input: CreateUserInput) => void;
  onToggleSuspendUser: (userId: string) => void;
  onSetUserPassword?: (userId: string, password: string) => Promise<void> | void;
  onDeleteUser: (userId: string) => void;
  onDeleteUserChat: (userId: string, chatId: string) => void;
  onSaveProviderToken: (submission: ProviderTokenSubmission) => Promise<string>;
  onDeleteProviderToken: (provider: AgentProvider) => Promise<void>;
}

export function AdminPage({
  users,
  providerTokens,
  botMode,
  authToken,
  onCheckOpenAiCosts,
  onBackToChat,
  onAddUser,
  onToggleSuspendUser,
  onSetUserPassword,
  onDeleteUser,
  onDeleteUserChat,
  onSaveProviderToken,
  onDeleteProviderToken,
}: AdminPageProps) {
  const [activeTab, setActiveTab] = useState<AdminTab>('users');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | UserStatus>('all');
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [inspectingUserId, setInspectingUserId] = useState<string | null>(null);
  const [passwordTargetUserId, setPasswordTargetUserId] = useState<string | null>(null);
  const [pendingDeleteUserId, setPendingDeleteUserId] = useState<string | null>(null);
  const [openAiAdminKey, setOpenAiAdminKey] = useState('');
  const [orgCostsLoading, setOrgCostsLoading] = useState(false);
  const [orgCostsError, setOrgCostsError] = useState<string | null>(null);
  const [orgCostsResult, setOrgCostsResult] = useState<OpenAiOrgCostsResponse | null>(null);
  const [backupNotice, setBackupNotice] = useState<string | null>(null);
  const [passwordNotice, setPasswordNotice] = useState<string | null>(null);
  const [backupBusy, setBackupBusy] = useState(false);

  const stats = useMemo(() => {
    let activeCount = 0;
    let suspendedCount = 0;
    let totalPromptTokens = 0;
    let totalCompletionTokens = 0;
    let totalTokens = 0;
    let totalLimit = 0;
    let totalChats = 0;
    let deletedChats = 0;
    let totalMessages = 0;
    let totalEstimatedUsd = 0;
    let totalOpenAiUsd = 0;
    let totalAnthropicUsd = 0;
    const userCostsMap: Record<string, { totalUsd: number; openAiUsd: number; anthropicUsd: number }> =
      {};

    for (const u of users) {
      if (u.status === 'active') activeCount += 1;
      else suspendedCount += 1;
      totalPromptTokens += u.tokenUsage.promptTokens;
      totalCompletionTokens += u.tokenUsage.completionTokens;
      totalTokens += u.tokenUsage.totalTokens;
      totalLimit += u.tokenUsage.tokenLimit;
      totalChats += u.chats.length;
      for (const c of u.chats) {
        if (c.deletedByUser) deletedChats += 1;
        totalMessages += c.messages.length;
      }

      const cost = estimateUserCostBreakdown(u);
      userCostsMap[u.id] = cost;
      totalEstimatedUsd += cost.totalUsd;
      totalOpenAiUsd += cost.openAiUsd;
      totalAnthropicUsd += cost.anthropicUsd;
    }

    const quotaPercent = totalLimit > 0 ? Math.min(100, Math.round((totalTokens / totalLimit) * 100)) : 0;

    return {
      totalUsers: users.length,
      activeCount,
      suspendedCount,
      totalPromptTokens,
      totalCompletionTokens,
      totalTokens,
      totalLimit,
      quotaPercent,
      totalChats,
      deletedChats,
      totalMessages,
      totalEstimatedUsd,
      totalOpenAiUsd,
      totalAnthropicUsd,
      userCostsMap,
    };
  }, [users]);

  const handleBackupSingleChat = async (user: ManagedUser, chat: ChatSession): Promise<string> => {
    setBackupBusy(true);
    try {
      const payload: ChatBackupPayload =
        botMode === 'api' && authToken
          ? await backupAdminChat(authToken, chat.id)
          : buildChatBackupPayload(user, chat);
      const filename = `chat-backup-${chat.id}.json`;
      downloadJsonBackup(filename, payload);
      const notice = `Backed up "${chat.title}" (${payload.messageCount} messages${payload.deletedByUser ? ', deleted by user' : ''}) to ${filename}.`;
      setBackupNotice(notice);
      return notice;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to create chat backup.';
      setBackupNotice(msg);
      throw err;
    } finally {
      setBackupBusy(false);
    }
  };

  const handleBackupUserChats = async (user: ManagedUser): Promise<string> => {
    setBackupBusy(true);
    try {
      const payload: WorkspaceChatsBackupPayload =
        botMode === 'api' && authToken
          ? await backupAdminUserChats(authToken, user.id)
          : buildUserChatsBackupPayload(user);
      const filename = `user-chats-backup-${user.id}.json`;
      downloadJsonBackup(filename, payload);
      const notice = `Backed up ${payload.totalChats} chats (${payload.deletedChats} deleted by user) for ${user.name} to ${filename}.`;
      setBackupNotice(notice);
      return notice;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to create user chats backup.';
      setBackupNotice(msg);
      throw err;
    } finally {
      setBackupBusy(false);
    }
  };

  const handleBackupAllWorkspaceChats = async () => {
    setBackupBusy(true);
    try {
      const payload: WorkspaceChatsBackupPayload =
        botMode === 'api' && authToken
          ? await backupAllAdminChats(authToken)
          : buildWorkspaceChatsBackupPayload(users);
      const filename = 'workspace-chats-backup.json';
      downloadJsonBackup(filename, payload);
      setBackupNotice(
        `Backed up ${payload.totalChats} chats (${payload.deletedChats} deleted by user) to ${filename}.`
      );
    } catch (err) {
      setBackupNotice(err instanceof Error ? err.message : 'Failed to create workspace backup.');
    } finally {
      setBackupBusy(false);
    }
  };

  const handleCheckOpenAiSpend = async () => {
    setOrgCostsError(null);
    if (!onCheckOpenAiCosts && botMode !== 'api') {
      setOrgCostsResult({
        available: false,
        periodDays: 30,
        totalSpendUsd: 0,
        remainingBalanceSupported: false,
        source: 'simulated',
        message:
          'Simulated mode uses token-based USD estimates on the left. Switch to API mode (Spring Boot backend) and sign in as Admin to query OpenAI /v1/organization/costs.',
      });
      return;
    }

    setOrgCostsLoading(true);
    try {
      const result = onCheckOpenAiCosts
        ? await onCheckOpenAiCosts(openAiAdminKey)
        : await fetchOpenAiOrgCosts(authToken || '', openAiAdminKey, 30);
      setOrgCostsResult(result);
    } catch (err) {
      setOrgCostsError(err instanceof Error ? err.message : 'Failed to query OpenAI billing.');
    } finally {
      setOrgCostsLoading(false);
    }
  };

  const handleSetUserPassword = async (userId: string, password: string) => {
    const targetUser = users.find((u) => u.id === userId);
    if (onSetUserPassword) {
      await onSetUserPassword(userId, password);
    } else if (botMode === 'api' && authToken) {
      await setAdminUserPassword(authToken, userId, password);
    }
    setPasswordNotice(
      `Password updated for ${targetUser ? `${targetUser.name} (${targetUser.email})` : 'user'}.`
    );
  };

  const filteredUsers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return users.filter((u) => {
      if (statusFilter !== 'all' && u.status !== statusFilter) return false;
      if (!q) return true;
      return (
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.role.toLowerCase().includes(q)
      );
    });
  }, [users, searchQuery, statusFilter]);

  const inspectingUser = users.find((u) => u.id === inspectingUserId) ?? null;
  const passwordTargetUser = users.find((u) => u.id === passwordTargetUserId) ?? null;

  return (
    <div className="flex h-dvh w-screen flex-col overflow-hidden bg-[#212121] text-[#ececec]">
      {/* Top Admin Header */}
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-[#171717] px-4 py-3 sm:px-6">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBackToChat}
            className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-[#242424] px-3 py-1.5 text-sm font-medium text-[#ececec] transition-colors hover:bg-[#2f2f2f]"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back to Chat</span>
          </button>

          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#10a37f]/20 text-[#10a37f]">
              <Shield className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-base font-semibold text-white sm:text-lg">Admin Console</h1>
              <p className="hidden text-xs text-[#8e8ea0] sm:block">
                Manage users, monitor token consumption, and inspect chats
              </p>
            </div>
          </div>
        </div>

        {activeTab === 'users' && (
          <button
            type="button"
            onClick={() => setAddModalOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-white px-3.5 py-2 text-sm font-medium text-[#212121] transition-colors hover:bg-[#e5e5e5]"
          >
            <UserPlus className="h-4 w-4" />
            <span>Add User</span>
          </button>
        )}
      </header>

      {/* Admin Navigation Tabs */}
      <div className="shrink-0 border-b border-white/10 bg-[#171717] px-4 sm:px-6">
        <div role="tablist" aria-label="Admin sections" className="mx-auto flex max-w-6xl gap-1">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'users'}
            onClick={() => setActiveTab('users')}
            className={[
              'inline-flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors',
              activeTab === 'users'
                ? 'border-[#10a37f] text-white'
                : 'border-transparent text-[#8e8ea0] hover:text-[#ececec]',
            ].join(' ')}
          >
            <Users className="h-4 w-4" />
            <span>User Statistics</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'tokens'}
            onClick={() => setActiveTab('tokens')}
            className={[
              'inline-flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors',
              activeTab === 'tokens'
                ? 'border-[#10a37f] text-white'
                : 'border-transparent text-[#8e8ea0] hover:text-[#ececec]',
            ].join(' ')}
          >
            <KeyRound className="h-4 w-4" />
            <span>API Tokens</span>
          </button>
        </div>
      </div>

      {/* Main Scrollable Content */}
      <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-6">
        <div className="mx-auto max-w-6xl space-y-6">
          {activeTab === 'tokens' ? (
            <ProviderTokensTab
              tokens={providerTokens}
              botMode={botMode}
              onSaveToken={onSaveProviderToken}
              onDeleteToken={onDeleteProviderToken}
            />
          ) : (
            <>
          {/* KPI Summary Cards */}
          <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5" aria-label="Workspace metrics">
            <div className="rounded-2xl border border-white/10 bg-[#1b1b1b] p-4">
              <div className="flex items-center justify-between text-xs text-[#8e8ea0]">
                <span>Total Users</span>
                <Users className="h-4 w-4 text-[#10a37f]" />
              </div>
              <div className="mt-2 text-2xl font-semibold text-white">{stats.totalUsers}</div>
              <div className="mt-1 text-xs text-[#b4b4b4]">
                {stats.activeCount} active · {stats.suspendedCount} suspended
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-[#1b1b1b] p-4">
              <div className="flex items-center justify-between text-xs text-[#8e8ea0]">
                <span>Tokens Consumed</span>
                <Cpu className="h-4 w-4 text-sky-400" />
              </div>
              <div className="mt-2 text-2xl font-semibold text-white">
                {formatTokenCount(stats.totalTokens)}
              </div>
              <div className="mt-1 text-xs text-[#b4b4b4]">
                {formatTokenCount(stats.totalPromptTokens)} prompt ·{' '}
                {formatTokenCount(stats.totalCompletionTokens)} completion
              </div>
            </div>

            <div
              className="rounded-2xl border border-emerald-500/20 bg-[#1b1b1b] p-4"
              data-testid="admin-estimated-spend-card"
            >
              <div className="flex items-center justify-between text-xs text-[#8e8ea0]">
                <span>Est. Funds Consumed</span>
                <DollarSign className="h-4 w-4 text-emerald-400" />
              </div>
              <div className="mt-2 text-2xl font-semibold text-emerald-400">
                {formatUsd(stats.totalEstimatedUsd)}
              </div>
              <div className="mt-1 text-xs text-[#b4b4b4]">
                OpenAI {formatUsd(stats.totalOpenAiUsd)} · Claude {formatUsd(stats.totalAnthropicUsd)}
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-[#1b1b1b] p-4">
              <div className="flex items-center justify-between text-xs text-[#8e8ea0]">
                <span>Conversations</span>
                <MessageSquare className="h-4 w-4 text-violet-400" />
              </div>
              <div className="mt-2 text-2xl font-semibold text-white">{stats.totalChats}</div>
              <div className="mt-1 text-xs text-[#b4b4b4]">
                {stats.totalMessages} messages
                {stats.deletedChats > 0 ? ` · ${stats.deletedChats} deleted` : ' logged'}
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-[#1b1b1b] p-4">
              <div className="flex items-center justify-between text-xs text-[#8e8ea0]">
                <span>Quota Utilization</span>
                <Activity className="h-4 w-4 text-amber-400" />
              </div>
              <div className="mt-2 text-2xl font-semibold text-white">{stats.quotaPercent}%</div>
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-[#10a37f] transition-all"
                  style={{ width: `${stats.quotaPercent}%` }}
                />
              </div>
            </div>
          </section>

          {/* Spend Estimation & OpenAI Billing Check */}
          <section
            className="grid grid-cols-1 gap-4 lg:grid-cols-2"
            aria-label="Funds consumption and OpenAI billing"
          >
            <div className="rounded-2xl border border-white/10 bg-[#1b1b1b] p-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-white">
                  Approximate Funds Consumption (Token-Based)
                </h2>
                <span className="rounded-md bg-emerald-500/15 px-2 py-0.5 text-[11px] font-medium text-emerald-300">
                  Total {formatUsd(stats.totalEstimatedUsd)}
                </span>
              </div>
              <p className="mt-1 text-xs text-[#8e8ea0]">
                Estimated from logged input/output tokens per model using public API list rates (USD per
                1M tokens).
              </p>

              <div className="mt-3 grid grid-cols-2 gap-2.5 text-xs">
                <div className="rounded-xl border border-white/10 bg-[#171717] px-3 py-2">
                  <div className="text-[#8e8ea0]">OpenAI (ChatGPT)</div>
                  <div className="mt-0.5 text-base font-semibold text-white">
                    {formatUsd(stats.totalOpenAiUsd)}
                  </div>
                  <div className="mt-0.5 text-[11px] text-[#8e8ea0]">
                    4o: $2.50/$10 · o3-mini: $1.10/$4.40
                  </div>
                </div>
                <div className="rounded-xl border border-white/10 bg-[#171717] px-3 py-2">
                  <div className="text-[#8e8ea0]">Anthropic (Claude)</div>
                  <div className="mt-0.5 text-base font-semibold text-white">
                    {formatUsd(stats.totalAnthropicUsd)}
                  </div>
                  <div className="mt-0.5 text-[11px] text-[#8e8ea0]">
                    Sonnet 4: $3/$15 · Opus 4: $15/$75
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-[#1b1b1b] p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-white">OpenAI Platform Spend & Balance</h2>
                <a
                  href="https://platform.openai.com/settings/organization/billing/overview"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-sky-400 hover:underline"
                >
                  <span>OpenAI Billing</span>
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>

              <p className="mt-1 flex items-start gap-1.5 text-xs text-[#8e8ea0]">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400" />
                <span>
                  OpenAI does <strong>not</strong> expose remaining prepaid credit balance via any API
                  key. You can query actual 30-day billed organization spend via{' '}
                  <code className="text-[#d1d5db]">/v1/organization/costs</code> with an Organization
                  Admin Key (<code className="text-[#d1d5db]">sk-admin-...</code>).
                </span>
              </p>

              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <input
                  type="password"
                  value={openAiAdminKey}
                  onChange={(e) => setOpenAiAdminKey(e.target.value)}
                  placeholder="Optional OpenAI Admin Key (sk-admin-...)"
                  aria-label="OpenAI Organization Admin Key"
                  className="min-w-0 flex-1 rounded-xl border border-white/10 bg-[#171717] px-3 py-1.5 text-xs text-[#ececec] placeholder-[#8e8ea0] outline-none focus:border-white/25"
                />
                <button
                  type="button"
                  onClick={() => void handleCheckOpenAiSpend()}
                  disabled={orgCostsLoading}
                  className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl border border-white/15 bg-[#252525] px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-[#303030] disabled:opacity-50"
                >
                  <RefreshCw className={['h-3.5 w-3.5', orgCostsLoading ? 'animate-spin' : ''].join(' ')} />
                  <span>{orgCostsLoading ? 'Checking...' : 'Check OpenAI Org Spend (30d)'}</span>
                </button>
              </div>

              {orgCostsError && (
                <div className="mt-2.5 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">
                  {orgCostsError}
                </div>
              )}

              {orgCostsResult && (
                <div
                  className={[
                    'mt-2.5 rounded-xl border px-3 py-2 text-xs',
                    orgCostsResult.available
                      ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-100'
                      : 'border-amber-500/30 bg-amber-500/10 text-amber-100',
                  ].join(' ')}
                  data-testid="openai-org-costs-result"
                >
                  {orgCostsResult.available && (
                    <div className="mb-1 font-semibold text-emerald-300">
                      {orgCostsResult.periodDays}-Day OpenAI Billed Spend:{' '}
                      {formatUsd(orgCostsResult.totalSpendUsd)}
                    </div>
                  )}
                  <div>{orgCostsResult.message}</div>
                </div>
              )}
            </div>
          </section>

          {/* Filter, Search & Backup Toolbar */}
          <section className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div className="relative max-w-sm flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[#8e8ea0]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search users by name, email, or role..."
                aria-label="Search users"
                className="w-full rounded-xl border border-white/10 bg-[#1b1b1b] py-2 pr-3 pl-9 text-sm text-[#ececec] placeholder-[#8e8ea0] outline-none focus:border-white/25"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => void handleBackupAllWorkspaceChats()}
                disabled={backupBusy || stats.totalChats === 0}
                aria-label="Backup all chats"
                className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 bg-[#1b1b1b] px-3 py-1.5 text-xs font-medium text-[#ececec] transition-colors hover:bg-[#2a2a2a] disabled:opacity-50"
              >
                <Download className="h-3.5 w-3.5 text-[#10a37f]" />
                <span>Backup All Chats</span>
              </button>

              <div className="inline-flex rounded-xl border border-white/10 bg-[#1b1b1b] p-1">
                {(['all', 'active', 'suspended'] as const).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setStatusFilter(tab)}
                    className={[
                      'rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition-colors',
                      statusFilter === tab
                        ? 'bg-[#2f2f2f] text-white'
                        : 'text-[#8e8ea0] hover:text-white',
                    ].join(' ')}
                  >
                    {tab}
                  </button>
                ))}
              </div>
            </div>
          </section>

          {passwordNotice && (
            <div
              data-testid="admin-password-status"
              className="flex items-center justify-between rounded-xl border border-sky-500/30 bg-sky-500/10 px-4 py-2.5 text-xs text-sky-100"
            >
              <span>{passwordNotice}</span>
              <button
                type="button"
                onClick={() => setPasswordNotice(null)}
                className="ml-3 text-[#8e8ea0] hover:text-white"
                aria-label="Dismiss password notice"
              >
                Dismiss
              </button>
            </div>
          )}

          {backupNotice && (
            <div
              data-testid="admin-backup-status"
              className="flex items-center justify-between rounded-xl border border-[#10a37f]/30 bg-[#10a37f]/10 px-4 py-2.5 text-xs text-emerald-100"
            >
              <span>{backupNotice}</span>
              <button
                type="button"
                onClick={() => setBackupNotice(null)}
                className="ml-3 text-[#8e8ea0] hover:text-white"
                aria-label="Dismiss backup notice"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* Users Table */}
          <section className="overflow-hidden rounded-2xl border border-white/10 bg-[#1b1b1b]">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-white/10 bg-[#171717] text-xs font-semibold tracking-wider text-[#8e8ea0] uppercase">
                    <th className="px-4 py-3.5">User</th>
                    <th className="px-4 py-3.5">Status</th>
                    <th className="px-4 py-3.5">Token Consumption</th>
                    <th className="px-4 py-3.5">Est. Spend</th>
                    <th className="px-4 py-3.5">Chats</th>
                    <th className="px-4 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-10 text-center text-sm text-[#8e8ea0]">
                        No users match your current filter.
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map((user) => {
                      const usagePct =
                        user.tokenUsage.tokenLimit > 0
                          ? Math.min(
                              100,
                              Math.round((user.tokenUsage.totalTokens / user.tokenUsage.tokenLimit) * 100)
                            )
                          : 0;
                      const userCost = stats.userCostsMap[user.id] ?? estimateUserCostBreakdown(user);
                      const userDeletedChatsCount = user.chats.filter((c) => c.deletedByUser).length;
                      const isConfirmingDelete = pendingDeleteUserId === user.id;

                      return (
                        <tr
                          key={user.id}
                          className="transition-colors hover:bg-white/[0.03]"
                          data-testid={`admin-user-row-${user.id}`}
                        >
                          <td className="px-4 py-3.5">
                            <div className="flex items-center gap-3">
                              <img
                                src={user.avatarUrl}
                                alt={`${user.name} avatar`}
                                className="h-9 w-9 shrink-0 rounded-full border border-white/15 object-cover"
                              />
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="truncate font-medium text-white">
                                    {user.name}
                                  </span>
                                  <span className="rounded-md bg-white/10 px-1.5 py-0.5 text-[10px] font-semibold text-[#d1d5db] uppercase">
                                    {user.role}
                                  </span>
                                  {user.isCurrentUser && (
                                    <span className="rounded-md bg-[#10a37f]/20 px-1.5 py-0.5 text-[10px] font-semibold text-[#10a37f]">
                                      You
                                    </span>
                                  )}
                                </div>
                                <div className="truncate text-xs text-[#8e8ea0]">{user.email}</div>
                              </div>
                            </div>
                          </td>

                          <td className="px-4 py-3.5">
                            <span
                              className={[
                                'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium',
                                user.status === 'active'
                                  ? 'bg-[#10a37f]/15 text-[#10a37f]'
                                  : 'bg-amber-500/15 text-amber-300',
                              ].join(' ')}
                            >
                              <span
                                className={[
                                  'h-1.5 w-1.5 rounded-full',
                                  user.status === 'active' ? 'bg-[#10a37f]' : 'bg-amber-400',
                                ].join(' ')}
                              />
                              {user.status === 'active' ? 'Active' : 'Suspended'}
                            </span>
                          </td>

                          <td className="px-4 py-3.5">
                            <div className="w-44">
                              <div className="flex items-baseline justify-between text-xs">
                                <span className="font-medium text-white">
                                  {user.tokenUsage.totalTokens.toLocaleString()}
                                </span>
                                <span className="text-[#8e8ea0]">
                                  / {formatTokenCount(user.tokenUsage.tokenLimit)} ({usagePct}%)
                                </span>
                              </div>
                              <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                                <div
                                  className={[
                                    'h-full rounded-full transition-all',
                                    usagePct >= 90
                                      ? 'bg-red-400'
                                      : usagePct >= 75
                                        ? 'bg-amber-400'
                                        : 'bg-[#10a37f]',
                                  ].join(' ')}
                                  style={{ width: `${usagePct}%` }}
                                />
                              </div>
                              <div className="mt-1 text-[11px] text-[#8e8ea0]">
                                In: {formatTokenCount(user.tokenUsage.promptTokens)} · Out:{' '}
                                {formatTokenCount(user.tokenUsage.completionTokens)}
                              </div>
                            </div>
                          </td>

                          <td className="px-4 py-3.5 whitespace-nowrap">
                            <div className="text-xs font-semibold text-emerald-400">
                              {formatUsd(userCost.totalUsd)}
                            </div>
                            <div className="mt-0.5 text-[11px] text-[#8e8ea0]">
                              {userCost.openAiUsd > 0 && userCost.anthropicUsd > 0
                                ? `OAI ${formatUsd(userCost.openAiUsd)} · CLD ${formatUsd(userCost.anthropicUsd)}`
                                : userCost.anthropicUsd > 0
                                  ? 'Claude est.'
                                  : userCost.openAiUsd > 0
                                    ? 'OpenAI est.'
                                    : 'No usage'}
                            </div>
                          </td>

                          <td className="px-4 py-3.5">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => setInspectingUserId(user.id)}
                                className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-[#252525] px-2.5 py-1.5 text-xs font-medium text-[#ececec] transition-colors hover:border-white/20 hover:bg-[#2f2f2f]"
                                aria-label={`View chats for ${user.name}`}
                              >
                                <MessageSquare className="h-3.5 w-3.5 text-[#10a37f]" />
                                <span>
                                  {user.chats.length} {user.chats.length === 1 ? 'chat' : 'chats'}
                                </span>
                              </button>

                              {userDeletedChatsCount > 0 && (
                                <span
                                  data-testid={`user-deleted-chats-badge-${user.id}`}
                                  title={`${userDeletedChatsCount} chat(s) deleted by user (retained for admin review & backup)`}
                                  className="inline-flex items-center gap-1 rounded-md border border-rose-500/30 bg-rose-500/15 px-2 py-1 text-[11px] font-medium text-rose-300"
                                >
                                  <Trash2 className="h-3 w-3" />
                                  <span>{userDeletedChatsCount} deleted</span>
                                </span>
                              )}

                              {user.chats.length > 0 && (
                                <button
                                  type="button"
                                  onClick={() => void handleBackupUserChats(user)}
                                  disabled={backupBusy}
                                  title={`Backup all chats for ${user.name}`}
                                  aria-label={`Backup chats for ${user.name}`}
                                  className="inline-flex items-center justify-center rounded-lg border border-white/10 bg-[#252525] p-1.5 text-[#b4b4b4] transition-colors hover:border-white/20 hover:bg-[#2f2f2f] hover:text-white disabled:opacity-50"
                                >
                                  <Download className="h-3.5 w-3.5" />
                                </button>
                              )}
                            </div>
                          </td>

                          <td className="px-4 py-3.5 text-right">
                            {isConfirmingDelete ? (
                              <div className="inline-flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => {
                                    onDeleteUser(user.id);
                                    setPendingDeleteUserId(null);
                                  }}
                                  className="rounded-lg bg-red-500/90 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-red-500"
                                  aria-label={`Confirm delete ${user.name}`}
                                >
                                  Confirm
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setPendingDeleteUserId(null)}
                                  className="rounded-lg border border-white/10 px-2.5 py-1.5 text-xs text-[#b4b4b4] hover:bg-white/10 hover:text-white"
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <div className="inline-flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => setPasswordTargetUserId(user.id)}
                                  className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-[#252525] px-2.5 py-1.5 text-xs font-medium text-[#ececec] transition-colors hover:border-white/20 hover:bg-[#2f2f2f]"
                                  aria-label={`Set password for ${user.name}`}
                                  title={`Set password for ${user.name}`}
                                >
                                  <KeyRound className="h-3.5 w-3.5 text-sky-400" />
                                  <span>Password</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => onToggleSuspendUser(user.id)}
                                  className={[
                                    'inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors',
                                    user.status === 'active'
                                      ? 'border-amber-500/30 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20'
                                      : 'border-[#10a37f]/30 bg-[#10a37f]/10 text-[#10a37f] hover:bg-[#10a37f]/20',
                                  ].join(' ')}
                                  aria-label={
                                    user.status === 'active'
                                      ? `Suspend ${user.name}`
                                      : `Activate ${user.name}`
                                  }
                                >
                                  {user.status === 'active' ? (
                                    <>
                                      <Ban className="h-3.5 w-3.5" />
                                      <span>Suspend</span>
                                    </>
                                  ) : (
                                    <>
                                      <CheckCircle2 className="h-3.5 w-3.5" />
                                      <span>Activate</span>
                                    </>
                                  )}
                                </button>

                                <button
                                  type="button"
                                  onClick={() => setPendingDeleteUserId(user.id)}
                                  className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-[#252525] px-2.5 py-1.5 text-xs font-medium text-[#b4b4b4] transition-colors hover:border-red-500/40 hover:bg-red-500/15 hover:text-red-300"
                                  aria-label={`Delete ${user.name}`}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                  <span>Delete</span>
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </section>
            </>
          )}
        </div>
      </div>

      <AddUserModal
        isOpen={addModalOpen}
        existingEmails={users.map((u) => u.email)}
        onClose={() => setAddModalOpen(false)}
        onAddUser={onAddUser}
      />

      <SetUserPasswordModal
        user={passwordTargetUser}
        onClose={() => setPasswordTargetUserId(null)}
        onSetPassword={handleSetUserPassword}
      />

      <UserChatsModal
        user={inspectingUser}
        onClose={() => setInspectingUserId(null)}
        onDeleteUserChat={onDeleteUserChat}
        onBackupChat={handleBackupSingleChat}
        onBackupUserChats={handleBackupUserChats}
      />
    </div>
  );
}
