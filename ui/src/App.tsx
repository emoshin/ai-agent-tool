import { useCallback, useEffect, useRef, useState } from 'react';
import { AdminPage } from './components/admin/AdminPage';
import { AuthScreen } from './components/AuthScreen';
import { ChatArea } from './components/ChatArea';
import { SettingsModal } from './components/SettingsModal';
import { Sidebar } from './components/Sidebar';
import { fetchCurrentUser, updateCurrentUserProfile } from './services/authService';
import {
  createAdminUser,
  deleteAdminUser,
  deleteAdminUserChat,
  deleteBackendChat,
  fetchAdminProviderTokens,
  fetchAdminUsers,
  fetchUserChats,
  updateAdminUserStatus,
} from './services/backendApiService';
import { sendBotMessage, type BotAdapter } from './services/botClient';
import { removeProviderToken, submitProviderToken } from './services/providerTokensService';
import type {
  AgentProvider,
  CreateUserInput,
  ManagedUser,
  ProviderTokenConfig,
  ProviderTokenSubmission,
} from './types/admin';
import type { BackendAuthSession } from './types/auth';
import type { BotSettings, ChatMessage, ChatSession, UserProfile } from './types/chat';
import { CURRENT_USER_ID } from './utils/adminDefaults';
import { AVAILABLE_MODELS, DEFAULT_AVATAR_SVG } from './utils/defaults';
import {
  deriveChatTitle,
  generateId,
  loadActiveChatId,
  loadAuthSession,
  loadBotSettings,
  loadChats,
  loadManagedUsers,
  loadProviderTokens,
  loadSidebarCollapsed,
  loadUserProfile,
  saveActiveChatId,
  saveAuthSession,
  saveBotSettings,
  saveChats,
  saveManagedUsers,
  saveProviderTokens,
  saveSidebarCollapsed,
  saveUserProfile,
} from './utils/storage';
import { estimateTokens } from './utils/tokens';

export interface AppProps {
  botAdapters?: {
    simulated?: BotAdapter;
    api?: BotAdapter;
  };
}

export function App({ botAdapters }: AppProps = {}) {
  const [chats, setChats] = useState<ChatSession[]>(() => loadChats());
  const [activeChatId, setActiveChatId] = useState<string | null>(() => loadActiveChatId(loadChats()));
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => loadSidebarCollapsed());
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile>(() => loadUserProfile());
  const [botSettings, setBotSettings] = useState<BotSettings>(() => loadBotSettings());
  const [authSession, setAuthSession] = useState<BackendAuthSession | null>(() => loadAuthSession());
  const [showAuthScreen, setShowAuthScreen] = useState<boolean>(() => {
    const initialSettings = loadBotSettings();
    const initialAuth = loadAuthSession();
    return initialSettings.mode === 'api' && !initialAuth && !initialSettings.apiKey.trim();
  });
  const [authNotice, setAuthNotice] = useState<string | null>(null);
  const [managedUsers, setManagedUsers] = useState<ManagedUser[]>(() => loadManagedUsers());
  const [providerTokens, setProviderTokens] = useState<ProviderTokenConfig[]>(() =>
    loadProviderTokens()
  );
  const [activeView, setActiveView] = useState<'chat' | 'admin'>('chat');
  const [draftInput, setDraftInput] = useState('');
  const [streamingChatId, setStreamingChatId] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const abortControllerRef = useRef<AbortController | null>(null);

  const activeChat = chats.find((c) => c.id === activeChatId) ?? null;
  const selectedModel = activeChat?.model ?? botSettings.defaultModel;
  const isStreaming = streamingChatId !== null;
  const currentUserId = authSession?.user.id ?? CURRENT_USER_ID;
  const currentManagedUser = managedUsers.find((u) => u.id === currentUserId);
  const isCurrentUserSuspended =
    authSession?.user.status === 'SUSPENDED' || currentManagedUser?.status === 'suspended';
  const isAdmin = !authSession || authSession.user.role === 'ADMIN';

  useEffect(() => {
    saveChats(chats);
  }, [chats]);

  useEffect(() => {
    saveActiveChatId(activeChatId);
  }, [activeChatId]);

  useEffect(() => {
    saveSidebarCollapsed(sidebarCollapsed);
  }, [sidebarCollapsed]);

  useEffect(() => {
    saveUserProfile(userProfile);
  }, [userProfile]);

  useEffect(() => {
    saveBotSettings(botSettings);
  }, [botSettings]);

  useEffect(() => {
    saveAuthSession(authSession);
  }, [authSession]);

  useEffect(() => {
    saveManagedUsers(managedUsers);
  }, [managedUsers]);

  useEffect(() => {
    saveProviderTokens(providerTokens);
  }, [providerTokens]);

  const syncBackendWorkspace = useCallback(async (session: BackendAuthSession) => {
    try {
      const [profile, backendChats] = await Promise.all([
        fetchCurrentUser(session.accessToken),
        fetchUserChats(session.accessToken),
      ]);

      setAuthSession((prev) => (prev ? { ...prev, user: profile } : { accessToken: session.accessToken, user: profile }));
      setUserProfile({
        name: profile.name,
        subtitle: profile.subtitle || 'Workspace Member',
        avatarUrl: profile.avatarUrl || DEFAULT_AVATAR_SVG,
      });

      if (backendChats.length > 0) {
        setChats(backendChats);
        setActiveChatId((prevId) =>
          prevId && backendChats.some((c) => c.id === prevId) ? prevId : backendChats[0].id
        );
      } else {
        setChats([]);
        setActiveChatId(null);
      }

      if (profile.role === 'ADMIN') {
        const [usersList, tokensList] = await Promise.all([
          fetchAdminUsers(session.accessToken, profile.id),
          fetchAdminProviderTokens(session.accessToken),
        ]);
        setManagedUsers(usersList);
        setProviderTokens(tokensList);
      }
    } catch (err) {
      const status = (err as { status?: number })?.status;
      if (status === 401) {
        setAuthSession(null);
        setBotSettings((prev) => ({ ...prev, apiKey: '' }));
        setAuthNotice('Your session expired. Please sign in again.');
        setShowAuthScreen(true);
      }
    }
  }, []);

  useEffect(() => {
    if (botSettings.mode === 'api' && authSession?.accessToken) {
      void syncBackendWorkspace(authSession);
    }
    // Run on mode/token change at startup or login
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [botSettings.mode, authSession?.accessToken]);

  const handleAuthenticated = useCallback(
    (session: BackendAuthSession) => {
      setAuthSession(session);
      setBotSettings((prev) => ({
        ...prev,
        mode: 'api',
        apiEndpoint: prev.apiEndpoint.trim() || '/api/chat',
        apiKey: session.accessToken,
      }));
      setUserProfile({
        name: session.user.name,
        subtitle: session.user.subtitle || 'Workspace Member',
        avatarUrl: session.user.avatarUrl || DEFAULT_AVATAR_SVG,
      });
      setAuthNotice(null);
      setShowAuthScreen(false);
      setActiveView('chat');
      void syncBackendWorkspace(session);
    },
    [syncBackendWorkspace]
  );

  const handleLogout = useCallback(() => {
    setAuthSession(null);
    setBotSettings((prev) => ({ ...prev, apiKey: '' }));
    setActiveView('chat');
    setAuthNotice(null);
    setShowAuthScreen(true);
  }, []);

  // Keep current user's live chats and profile synced in the Admin directory (simulated mode)
  useEffect(() => {
    if (botSettings.mode === 'api' && authSession) return;
    setManagedUsers((prev) =>
      prev.map((u) =>
        u.id === CURRENT_USER_ID
          ? {
              ...u,
              name: userProfile.name,
              avatarUrl: userProfile.avatarUrl,
              chats,
            }
          : u
      )
    );
  }, [authSession, botSettings.mode, chats, userProfile.avatarUrl, userProfile.name]);

  const stopStreaming = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setStreamingChatId(null);
  }, []);

  const handleNewChat = useCallback(() => {
    stopStreaming();
    const existingEmpty = chats.find((c) => c.messages.length === 0);
    if (existingEmpty) {
      setActiveChatId(existingEmpty.id);
      return;
    }

    const now = Date.now();
    const newChat: ChatSession = {
      id: generateId('chat'),
      title: 'New chat',
      messages: [],
      model: botSettings.defaultModel,
      createdAt: now,
      updatedAt: now,
    };
    setChats((prev) => [newChat, ...prev]);
    setActiveChatId(newChat.id);
    setDraftInput('');
  }, [botSettings.defaultModel, chats, stopStreaming]);

  const handleSelectChat = useCallback(
    (chatId: string) => {
      if (chatId !== activeChatId && isStreaming) {
        stopStreaming();
      }
      setActiveChatId(chatId);
    },
    [activeChatId, isStreaming, stopStreaming]
  );

  const handleRenameChat = useCallback((chatId: string, newTitle: string) => {
    setChats((prev) =>
      prev.map((c) => (c.id === chatId ? { ...c, title: newTitle, updatedAt: Date.now() } : c))
    );
  }, []);

  const handleDeleteChat = useCallback(
    (chatId: string) => {
      if (streamingChatId === chatId) {
        stopStreaming();
      }
      if (botSettings.mode === 'api' && authSession?.accessToken) {
        void deleteBackendChat(authSession.accessToken, chatId).catch(() => {});
      }
      setChats((prev) => {
        const remaining = prev.filter((c) => c.id !== chatId);
        if (activeChatId === chatId) {
          setActiveChatId(remaining[0]?.id ?? null);
        }
        return remaining;
      });
    },
    [activeChatId, authSession?.accessToken, botSettings.mode, stopStreaming, streamingChatId]
  );

  const handleSelectModel = useCallback(
    (modelId: string) => {
      if (activeChat && activeChat.messages.length > 0) {
        return;
      }
      setBotSettings((prev) => ({ ...prev, defaultModel: modelId }));
      if (activeChatId) {
        setChats((prev) =>
          prev.map((c) =>
            c.id === activeChatId && c.messages.length === 0 ? { ...c, model: modelId } : c
          )
        );
      }
    },
    [activeChat, activeChatId]
  );

  const runBotStream = useCallback(
    async (
      targetChatId: string,
      historyForBot: ChatMessage[],
      assistantMessageId: string,
      model: string
    ) => {
      const controller = new AbortController();
      abortControllerRef.current = controller;
      setStreamingChatId(targetChatId);

      try {
        let streamedResponse = '';
        const promptTokensDelta = historyForBot.reduce(
          (sum, m) => sum + (m.tokenCount ?? estimateTokens(m.content)),
          0
        );

        const effectiveSettings: BotSettings =
          botSettings.mode === 'api' && !botSettings.apiKey.trim() && authSession?.accessToken
            ? { ...botSettings, apiKey: authSession.accessToken }
            : botSettings;

        await sendBotMessage(
          {
            chatId: targetChatId,
            messages: historyForBot,
            model,
            settings: effectiveSettings,
            signal: controller.signal,
            onToken: (delta) => {
              streamedResponse += delta;
              setChats((prev) =>
                prev.map((chat) =>
                  chat.id === targetChatId
                    ? {
                        ...chat,
                        updatedAt: Date.now(),
                        messages: chat.messages.map((msg) =>
                          msg.id === assistantMessageId
                            ? { ...msg, content: msg.content + delta }
                            : msg
                        ),
                      }
                    : chat
                )
              );
            },
          },
          botAdapters
        );

        const completionTokensDelta = estimateTokens(streamedResponse);

        setChats((prev) =>
          prev.map((chat) =>
            chat.id === targetChatId
              ? {
                  ...chat,
                  updatedAt: Date.now(),
                  messages: chat.messages.map((msg) =>
                    msg.id === assistantMessageId
                      ? { ...msg, isStreaming: false, tokenCount: completionTokensDelta }
                      : msg
                  ),
                }
              : chat
          )
        );

        if (botSettings.mode === 'api' && authSession?.accessToken) {
          void syncBackendWorkspace(authSession);
        } else {
          setManagedUsers((prev) =>
            prev.map((u) =>
              u.id === CURRENT_USER_ID
                ? {
                    ...u,
                    lastActiveAt: Date.now(),
                    tokenUsage: {
                      ...u.tokenUsage,
                      promptTokens: u.tokenUsage.promptTokens + promptTokensDelta,
                      completionTokens: u.tokenUsage.completionTokens + completionTokensDelta,
                      totalTokens:
                        u.tokenUsage.totalTokens + promptTokensDelta + completionTokensDelta,
                    },
                  }
                : u
            )
          );
        }
      } catch (err) {
        const isAbort = err instanceof DOMException && err.name === 'AbortError';
        const status = (err as { status?: number })?.status;
        if (
          !isAbort &&
          botSettings.mode === 'api' &&
          (status === 401 || (status === 403 && !authSession))
        ) {
          setAuthSession(null);
          setBotSettings((prev) => ({ ...prev, apiKey: '' }));
          setAuthNotice('Authentication required (401/403). Please sign in to continue.');
          setShowAuthScreen(true);
        }
        setChats((prev) =>
          prev.map((chat) => {
            if (chat.id !== targetChatId) return chat;
            return {
              ...chat,
              messages: chat.messages
                .map((msg) => {
                  if (msg.id !== assistantMessageId) return msg;
                  if (isAbort) {
                    return { ...msg, isStreaming: false };
                  }
                  const errorMsg =
                    err instanceof Error ? err.message : 'Failed to receive response from AI bot.';
                  return {
                    ...msg,
                    content: msg.content ? `${msg.content}\n\n_${errorMsg}_` : errorMsg,
                    isStreaming: false,
                    isError: true,
                  };
                })
                .filter((msg) => !(msg.id === assistantMessageId && isAbort && !msg.content)),
            };
          })
        );
      } finally {
        if (abortControllerRef.current === controller) {
          abortControllerRef.current = null;
          setStreamingChatId(null);
        }
      }
    },
    [authSession, botAdapters, botSettings, syncBackendWorkspace]
  );

  const handleSendMessage = useCallback(
    async (overrideText?: string) => {
      if (isStreaming || isCurrentUserSuspended) return;
      const text = (overrideText ?? draftInput).trim();
      if (!text) return;

      if (!overrideText) {
        setDraftInput('');
      }

      const now = Date.now();
      const userMessage: ChatMessage = {
        id: generateId('msg'),
        role: 'user',
        content: text,
        createdAt: now,
        tokenCount: estimateTokens(text),
      };
      const assistantMessage: ChatMessage = {
        id: generateId('msg'),
        role: 'assistant',
        content: '',
        createdAt: now + 1,
        isStreaming: true,
      };

      let targetChatId = activeChat?.id ?? null;
      let targetModel = selectedModel;
      let historyForBot: ChatMessage[] = [];

      if (!targetChatId) {
        targetChatId = generateId('chat');
        const createdChat: ChatSession = {
          id: targetChatId,
          title: deriveChatTitle(text),
          model: targetModel,
          messages: [userMessage, assistantMessage],
          createdAt: now,
          updatedAt: now,
        };
        historyForBot = [userMessage];
        setChats((prev) => [createdChat, ...prev]);
        setActiveChatId(targetChatId);
      } else {
        const currentMessages = activeChat?.messages ?? [];
        historyForBot = [...currentMessages, userMessage];
        targetModel = activeChat?.model ?? selectedModel;

        setChats((prev) =>
          prev.map((chat) => {
            if (chat.id !== targetChatId) return chat;
            const shouldRename = chat.messages.length === 0 && chat.title === 'New chat';
            return {
              ...chat,
              title: shouldRename ? deriveChatTitle(text) : chat.title,
              updatedAt: now,
              messages: [...chat.messages, userMessage, assistantMessage],
            };
          })
        );
      }

      await runBotStream(targetChatId, historyForBot, assistantMessage.id, targetModel);
    },
    [activeChat, draftInput, isCurrentUserSuspended, isStreaming, runBotStream, selectedModel]
  );

  const handleRegenerate = useCallback(async () => {
    if (!activeChat || isStreaming || isCurrentUserSuspended) return;
    const messages = activeChat.messages;
    const lastAssistantIndex = [...messages].reverse().findIndex((m) => m.role === 'assistant');
    if (lastAssistantIndex === -1) return;

    const actualIdx = messages.length - 1 - lastAssistantIndex;
    const historyWithoutLastAssistant = messages.slice(0, actualIdx);
    const assistantMessage: ChatMessage = {
      id: generateId('msg'),
      role: 'assistant',
      content: '',
      createdAt: Date.now(),
      isStreaming: true,
    };

    setChats((prev) =>
      prev.map((chat) =>
        chat.id === activeChat.id
          ? {
              ...chat,
              updatedAt: Date.now(),
              messages: [...historyWithoutLastAssistant, assistantMessage],
            }
          : chat
      )
    );

    await runBotStream(activeChat.id, historyWithoutLastAssistant, assistantMessage.id, activeChat.model);
  }, [activeChat, isCurrentUserSuspended, isStreaming, runBotStream]);

  const handleAddUser = useCallback(
    (input: CreateUserInput) => {
      if (botSettings.mode === 'api' && authSession?.accessToken) {
        void createAdminUser(authSession.accessToken, input, authSession.user.id)
          .then((created) => {
            setManagedUsers((prev) => [created, ...prev]);
          })
          .catch(() => {});
        return;
      }

      const now = Date.now();
      const created: ManagedUser = {
        id: generateId('user'),
        name: input.name,
        email: input.email,
        role: input.role,
        status: 'active',
        avatarUrl: input.avatarUrl,
        createdAt: now,
        lastActiveAt: now,
        tokenUsage: {
          promptTokens: 0,
          completionTokens: 0,
          totalTokens: 0,
          tokenLimit: input.tokenLimit,
        },
        chats: [],
      };
      setManagedUsers((prev) => [created, ...prev]);
    },
    [authSession, botSettings.mode]
  );

  const handleToggleSuspendUser = useCallback(
    (userId: string) => {
      const target = managedUsers.find((u) => u.id === userId);
      const nextStatus = target?.status === 'active' ? 'suspended' : 'active';

      if (botSettings.mode === 'api' && authSession?.accessToken) {
        void updateAdminUserStatus(authSession.accessToken, userId, nextStatus, authSession.user.id)
          .then((updated) => {
            setManagedUsers((prev) =>
              prev.map((u) => (u.id === userId ? { ...updated, chats: u.chats } : u))
            );
          })
          .catch(() => {});
        return;
      }

      setManagedUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, status: nextStatus } : u))
      );
    },
    [authSession, botSettings.mode, managedUsers]
  );

  const handleDeleteUser = useCallback(
    (userId: string) => {
      if (botSettings.mode === 'api' && authSession?.accessToken) {
        void deleteAdminUser(authSession.accessToken, userId)
          .then(() => {
            setManagedUsers((prev) => prev.filter((u) => u.id !== userId));
          })
          .catch(() => {});
        return;
      }
      setManagedUsers((prev) => prev.filter((u) => u.id !== userId));
    },
    [authSession, botSettings.mode]
  );

  const handleDeleteUserChat = useCallback(
    (userId: string, chatId: string) => {
      if (botSettings.mode === 'api' && authSession?.accessToken) {
        void deleteAdminUserChat(authSession.accessToken, userId, chatId)
          .then(() => {
            setManagedUsers((prev) =>
              prev.map((u) =>
                u.id === userId ? { ...u, chats: u.chats.filter((c) => c.id !== chatId) } : u
              )
            );
            if (userId === authSession.user.id) {
              setChats((prev) => prev.filter((c) => c.id !== chatId));
            }
          })
          .catch(() => {});
        return;
      }

      if (userId === CURRENT_USER_ID) {
        handleDeleteChat(chatId);
        return;
      }
      setManagedUsers((prev) =>
        prev.map((u) =>
          u.id === userId ? { ...u, chats: u.chats.filter((c) => c.id !== chatId) } : u
        )
      );
    },
    [authSession, botSettings.mode, handleDeleteChat]
  );

  const handleSaveProviderToken = useCallback(
    async (submission: ProviderTokenSubmission): Promise<string> => {
      const authToken = authSession?.accessToken || botSettings.apiKey || undefined;
      const result = await submitProviderToken(
        submission,
        botSettings.mode,
        '/api/admin/provider-tokens',
        authToken
      );
      setProviderTokens((prev) =>
        prev.map((item) => (item.provider === submission.provider ? result.config : item))
      );
      return result.message;
    },
    [authSession?.accessToken, botSettings.apiKey, botSettings.mode]
  );

  const handleDeleteProviderToken = useCallback(
    async (provider: AgentProvider): Promise<void> => {
      const authToken = authSession?.accessToken || botSettings.apiKey || undefined;
      await removeProviderToken(
        provider,
        botSettings.mode,
        '/api/admin/provider-tokens',
        authToken
      );
      setProviderTokens((prev) =>
        prev.map((item) =>
          item.provider === provider ? { ...item, apiKey: '', updatedAt: null } : item
        )
      );
    },
    [authSession?.accessToken, botSettings.apiKey, botSettings.mode]
  );

  if (showAuthScreen) {
    return (
      <AuthScreen
        initialNotice={authNotice}
        onAuthenticated={handleAuthenticated}
        onUseSimulatedMode={() => {
          setBotSettings((prev) => ({ ...prev, mode: 'simulated' }));
          setAuthNotice(null);
          setShowAuthScreen(false);
        }}
      />
    );
  }

  if (activeView === 'admin') {
    return (
      <AdminPage
        users={managedUsers}
        providerTokens={providerTokens}
        botMode={botSettings.mode}
        authToken={authSession?.accessToken || botSettings.apiKey || undefined}
        onBackToChat={() => setActiveView('chat')}
        onAddUser={handleAddUser}
        onToggleSuspendUser={handleToggleSuspendUser}
        onDeleteUser={handleDeleteUser}
        onDeleteUserChat={handleDeleteUserChat}
        onSaveProviderToken={handleSaveProviderToken}
        onDeleteProviderToken={handleDeleteProviderToken}
      />
    );
  }

  return (
    <div className="flex h-dvh w-screen overflow-hidden bg-[#212121] text-[#ececec]">
      <Sidebar
        chats={chats}
        activeChatId={activeChatId}
        isCollapsed={sidebarCollapsed}
        isMobileOpen={mobileSidebarOpen}
        userProfile={userProfile}
        botMode={botSettings.mode}
        isAuthenticated={Boolean(authSession)}
        isAdmin={isAdmin}
        onToggleCollapse={() => setSidebarCollapsed((prev) => !prev)}
        onCloseMobile={() => setMobileSidebarOpen(false)}
        onNewChat={handleNewChat}
        onSelectChat={handleSelectChat}
        onRenameChat={handleRenameChat}
        onDeleteChat={handleDeleteChat}
        onOpenSettings={() => setSettingsOpen(true)}
        onOpenAdmin={() => setActiveView('admin')}
        onOpenAuth={() => {
          setAuthNotice(null);
          setShowAuthScreen(true);
        }}
        onLogout={handleLogout}
      />

      <ChatArea
        chat={activeChat}
        models={AVAILABLE_MODELS}
        selectedModel={selectedModel}
        userProfile={userProfile}
        botMode={botSettings.mode}
        isSidebarCollapsed={sidebarCollapsed}
        isStreaming={isStreaming}
        isUserSuspended={isCurrentUserSuspended}
        isAuthenticated={Boolean(authSession)}
        isAdmin={isAdmin}
        draftInput={draftInput}
        onDraftChange={setDraftInput}
        onExpandSidebar={() => setSidebarCollapsed(false)}
        onOpenMobileSidebar={() => setMobileSidebarOpen(true)}
        onNewChat={handleNewChat}
        onSelectModel={handleSelectModel}
        onSendMessage={handleSendMessage}
        onStopStreaming={stopStreaming}
        onRegenerate={handleRegenerate}
        onOpenSettings={() => setSettingsOpen(true)}
        onOpenAdmin={() => setActiveView('admin')}
        onOpenAuth={() => {
          setAuthNotice(null);
          setShowAuthScreen(true);
        }}
      />

      {settingsOpen && (
        <SettingsModal
          isOpen={settingsOpen}
          botSettings={botSettings}
          userProfile={userProfile}
          authEmail={authSession?.user.email ?? null}
          authRole={authSession?.user.role ?? null}
          onClose={() => setSettingsOpen(false)}
          onOpenAuth={() => {
            setAuthNotice(null);
            setShowAuthScreen(true);
          }}
          onLogout={handleLogout}
          onSave={(nextSettings, nextProfile, newPassword) => {
            setBotSettings(nextSettings);
            setUserProfile(nextProfile);
            if (authSession?.accessToken) {
              void updateCurrentUserProfile(authSession.accessToken, {
                name: nextProfile.name,
                subtitle: nextProfile.subtitle,
                avatarUrl: nextProfile.avatarUrl,
                ...(newPassword ? { newPassword } : {}),
              })
                .then((updatedUser) => {
                  setAuthSession((prev) =>
                    prev ? { ...prev, user: updatedUser } : null
                  );
                })
                .catch(() => {});
            }
          }}
        />
      )}
    </div>
  );
}

export default App;
