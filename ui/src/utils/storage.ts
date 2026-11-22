import type { ManagedUser, ProviderTokenConfig } from '../types/admin';
import type { BackendAuthSession } from '../types/auth';
import type { BotSettings, ChatSession, UserProfile } from '../types/chat';
import { DEFAULT_PROVIDER_TOKENS } from '../services/providerTokensService';
import { INITIAL_MANAGED_USERS } from './adminDefaults';
import { DEFAULT_BOT_SETTINGS, DEFAULT_USER_PROFILE, INITIAL_CHATS } from './defaults';

const KEYS = {
  CHATS: 'ai_agent_ui_chats_v1',
  ACTIVE_CHAT: 'ai_agent_ui_active_chat_v1',
  SIDEBAR_COLLAPSED: 'ai_agent_ui_sidebar_collapsed_v1',
  USER_PROFILE: 'ai_agent_ui_user_profile_v1',
  BOT_SETTINGS: 'ai_agent_ui_bot_settings_v1',
  MANAGED_USERS: 'ai_agent_ui_managed_users_v1',
  PROVIDER_TOKENS: 'ai_agent_ui_provider_tokens_v1',
  AUTH_SESSION: 'ai_agent_ui_auth_session_v1',
} as const;

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore storage quota or private-browsing errors
  }
}

export function loadChats(): ChatSession[] {
  const chats = readJson<ChatSession[] | null>(KEYS.CHATS, null);
  if (!chats || !Array.isArray(chats) || chats.length === 0) {
    return INITIAL_CHATS;
  }
  return chats;
}

export function saveChats(chats: ChatSession[]): void {
  writeJson(KEYS.CHATS, chats);
}

export function loadActiveChatId(chats: ChatSession[]): string | null {
  try {
    const saved = localStorage.getItem(KEYS.ACTIVE_CHAT);
    if (saved && chats.some((c) => c.id === saved)) {
      return saved;
    }
    return chats[0]?.id ?? null;
  } catch {
    return chats[0]?.id ?? null;
  }
}

export function saveActiveChatId(chatId: string | null): void {
  try {
    if (chatId === null) {
      localStorage.removeItem(KEYS.ACTIVE_CHAT);
    } else {
      localStorage.setItem(KEYS.ACTIVE_CHAT, chatId);
    }
  } catch {
    // Ignore
  }
}

export function loadSidebarCollapsed(): boolean {
  return readJson<boolean>(KEYS.SIDEBAR_COLLAPSED, false);
}

export function saveSidebarCollapsed(collapsed: boolean): void {
  writeJson(KEYS.SIDEBAR_COLLAPSED, collapsed);
}

export function loadUserProfile(): UserProfile {
  return { ...DEFAULT_USER_PROFILE, ...readJson<Partial<UserProfile>>(KEYS.USER_PROFILE, {}) };
}

export function saveUserProfile(profile: UserProfile): void {
  writeJson(KEYS.USER_PROFILE, profile);
}

export function loadBotSettings(): BotSettings {
  return { ...DEFAULT_BOT_SETTINGS, ...readJson<Partial<BotSettings>>(KEYS.BOT_SETTINGS, {}) };
}

export function saveBotSettings(settings: BotSettings): void {
  writeJson(KEYS.BOT_SETTINGS, settings);
}

export function loadManagedUsers(): ManagedUser[] {
  const users = readJson<ManagedUser[] | null>(KEYS.MANAGED_USERS, null);
  if (!users || !Array.isArray(users) || users.length === 0) {
    return INITIAL_MANAGED_USERS;
  }
  return users;
}

export function saveManagedUsers(users: ManagedUser[]): void {
  writeJson(KEYS.MANAGED_USERS, users);
}

export function loadProviderTokens(): ProviderTokenConfig[] {
  const saved = readJson<ProviderTokenConfig[] | null>(KEYS.PROVIDER_TOKENS, null);
  if (!saved || !Array.isArray(saved) || saved.length === 0) {
    return DEFAULT_PROVIDER_TOKENS;
  }
  return DEFAULT_PROVIDER_TOKENS.map((def) => {
    const match = saved.find((item) => item.provider === def.provider);
    return match ? { ...def, ...match } : def;
  });
}

export function saveProviderTokens(tokens: ProviderTokenConfig[]): void {
  writeJson(KEYS.PROVIDER_TOKENS, tokens);
}

export function loadAuthSession(): BackendAuthSession | null {
  return readJson<BackendAuthSession | null>(KEYS.AUTH_SESSION, null);
}

export function saveAuthSession(session: BackendAuthSession | null): void {
  try {
    if (session === null) {
      localStorage.removeItem(KEYS.AUTH_SESSION);
    } else {
      localStorage.setItem(KEYS.AUTH_SESSION, JSON.stringify(session));
    }
  } catch {
    // Ignore
  }
}

export function generateId(prefix = 'id'): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function deriveChatTitle(prompt: string): string {
  const cleaned = prompt.trim().replace(/\s+/g, ' ');
  if (!cleaned) return 'New chat';
  return cleaned.length > 42 ? `${cleaned.slice(0, 42).trimEnd()}…` : cleaned;
}

export interface ChatGroup {
  label: string;
  chats: ChatSession[];
}

export function groupChatsByDate(chats: ChatSession[], now = Date.now()): ChatGroup[] {
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const todayMs = startOfToday.getTime();
  const yesterdayMs = todayMs - 24 * 60 * 60 * 1000;
  const sevenDaysMs = todayMs - 7 * 24 * 60 * 60 * 1000;

  const sorted = [...chats].sort((a, b) => b.updatedAt - a.updatedAt);

  const buckets: Record<string, ChatSession[]> = {
    Today: [],
    Yesterday: [],
    'Previous 7 Days': [],
    Older: [],
  };

  for (const chat of sorted) {
    if (chat.updatedAt >= todayMs) {
      buckets.Today.push(chat);
    } else if (chat.updatedAt >= yesterdayMs) {
      buckets.Yesterday.push(chat);
    } else if (chat.updatedAt >= sevenDaysMs) {
      buckets['Previous 7 Days'].push(chat);
    } else {
      buckets.Older.push(chat);
    }
  }

  return Object.entries(buckets)
    .filter(([, groupChats]) => groupChats.length > 0)
    .map(([label, groupChats]) => ({ label, chats: groupChats }));
}
