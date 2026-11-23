import { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowDown,
  ChevronDown,
  Lock,
  LogIn,
  Menu,
  PanelLeftOpen,
  Settings,
  Shield,
  SquarePen,
} from 'lucide-react';
import { useI18n, type TranslationKey } from '../i18n/I18nContext';
import type { BotAdapterMode, ChatSession, ModelOption, UserProfile } from '../types/chat';
import { getModelDisplayName, STARTER_PROMPTS } from '../utils/defaults';
import { ChatInput } from './ChatInput';
import { LanguageSwitcher } from './LanguageSwitcher';
import { MessageBubble } from './MessageBubble';
import { ModelIcon } from './ModelIcon';

interface ChatAreaProps {
  chat: ChatSession | null;
  models: ModelOption[];
  selectedModel: string;
  userProfile: UserProfile;
  botMode: BotAdapterMode;
  isSidebarCollapsed: boolean;
  isStreaming: boolean;
  isUserSuspended?: boolean;
  isAuthenticated?: boolean;
  isAdmin?: boolean;
  draftInput: string;
  onDraftChange: (value: string) => void;
  onExpandSidebar: () => void;
  onOpenMobileSidebar: () => void;
  onNewChat: () => void;
  onSelectModel: (modelId: string) => void;
  onSendMessage: (overrideText?: string) => void;
  onStopStreaming: () => void;
  onRegenerate: () => void;
  onOpenSettings: () => void;
  onOpenAdmin: () => void;
  onOpenAuth?: () => void;
}

export function ChatArea({
  chat,
  models,
  selectedModel,
  userProfile,
  botMode,
  isSidebarCollapsed,
  isStreaming,
  isUserSuspended = false,
  isAuthenticated = false,
  isAdmin = true,
  draftInput,
  onDraftChange,
  onExpandSidebar,
  onOpenMobileSidebar,
  onNewChat,
  onSelectModel,
  onSendMessage,
  onStopStreaming,
  onRegenerate,
  onOpenSettings,
  onOpenAdmin,
  onOpenAuth,
}: ChatAreaProps) {
  const { t } = useI18n();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const bottomAnchorRef = useRef<HTMLDivElement>(null);
  const [showScrollBottom, setShowScrollBottom] = useState(false);
  const [modelMenuOpen, setModelMenuOpen] = useState(false);
  const userScrolledUpRef = useRef(false);
  const modelMenuRef = useRef<HTMLDivElement>(null);

  const messages = chat?.messages ?? [];
  const isModelEditable = !chat || messages.length === 0;
  const activeModelOption = models.find((m) => m.id === selectedModel);
  const activeModelName = activeModelOption?.name ?? getModelDisplayName(selectedModel);

  useEffect(() => {
    if (!isModelEditable) {
      setModelMenuOpen(false);
    }
  }, [isModelEditable]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (modelMenuRef.current && !modelMenuRef.current.contains(event.target as Node)) {
        setModelMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    userScrolledUpRef.current = false;
    setShowScrollBottom(false);
    bottomAnchorRef.current?.scrollIntoView({ behavior: 'auto' });
  }, [chat?.id]);

  useEffect(() => {
    if (!userScrolledUpRef.current) {
      bottomAnchorRef.current?.scrollIntoView({ behavior: 'auto' });
    }
  }, [messages.length, messages[messages.length - 1]?.content]);

  const handleScroll = () => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    const isNearBottom = distanceFromBottom < 80;
    userScrolledUpRef.current = !isNearBottom;
    setShowScrollBottom(!isNearBottom && messages.length > 0);
  };

  const scrollToBottom = () => {
    userScrolledUpRef.current = false;
    setShowScrollBottom(false);
    bottomAnchorRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const lastAssistantId = [...messages].reverse().find((m) => m.role === 'assistant')?.id;

  const getModelDescription = (model: ModelOption): string => {
    const key = `model.${model.id}.desc` as TranslationKey;
    const localized = t(key);
    return localized === key ? model.description : localized;
  };

  return (
    <main className="relative flex min-w-0 flex-1 flex-col bg-[#212121]">
      {/* Top Header */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-white/5 px-3 sm:px-4">
        <div className="flex items-center gap-1.5">
          {/* Mobile menu button */}
          <button
            type="button"
            onClick={onOpenMobileSidebar}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-[#b4b4b4] transition-colors hover:bg-[#2f2f2f] hover:text-white md:hidden"
            title={t('chat.openSidebar')}
            aria-label={t('chat.openSidebar')}
          >
            <Menu className="h-5 w-5" />
          </button>

          {/* Desktop expand sidebar button (visible when collapsed) */}
          {isSidebarCollapsed && (
            <>
              <button
                type="button"
                onClick={onExpandSidebar}
                className="hidden h-9 w-9 items-center justify-center rounded-lg text-[#b4b4b4] transition-colors hover:bg-[#2f2f2f] hover:text-white md:inline-flex"
                title={t('chat.expandSidebar')}
                aria-label={t('chat.expandSidebar')}
              >
                <PanelLeftOpen className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={onNewChat}
                className="hidden h-9 w-9 items-center justify-center rounded-lg text-[#b4b4b4] transition-colors hover:bg-[#2f2f2f] hover:text-white md:inline-flex"
                title={t('sidebar.newChat')}
                aria-label={t('chat.newChatHeaderAria')}
              >
                <SquarePen className="h-5 w-5" />
              </button>
            </>
          )}

          {/* Model Selector (editable ONLY in a new chat; locked once messages exist) */}
          <div className="relative" ref={modelMenuRef}>
            {isModelEditable ? (
              <>
                <button
                  type="button"
                  onClick={() => setModelMenuOpen((prev) => !prev)}
                  className="inline-flex items-center gap-2 rounded-xl px-3 py-1.5 text-base font-semibold text-[#ececec] transition-colors hover:bg-[#2f2f2f]"
                  aria-haspopup="listbox"
                  aria-expanded={modelMenuOpen}
                  aria-label={t('chat.selectModelAria')}
                >
                  <ModelIcon modelId={selectedModel} className="h-4 w-4 shrink-0" />
                  <span>{activeModelName}</span>
                  <ChevronDown className="h-4 w-4 text-[#8e8ea0]" />
                </button>

                {modelMenuOpen && (
                  <div
                    role="listbox"
                    aria-label={t('chat.selectAiModelAria')}
                    className="absolute left-0 z-30 mt-1.5 w-80 rounded-2xl border border-white/10 bg-[#2f2f2f] p-1.5 shadow-2xl"
                  >
                    {models.map((model) => {
                      const isSelected = model.id === selectedModel;
                      return (
                        <button
                          key={model.id}
                          type="button"
                          role="option"
                          aria-selected={isSelected}
                          onClick={() => {
                            onSelectModel(model.id);
                            setModelMenuOpen(false);
                          }}
                          className={[
                            'flex w-full items-start gap-2.5 rounded-xl px-3 py-2.5 text-left transition-colors',
                            isSelected ? 'bg-white/10 text-white' : 'text-[#d1d5db] hover:bg-white/5',
                          ].join(' ')}
                        >
                          <ModelIcon provider={model.provider} className="mt-0.5 h-4 w-4 shrink-0" />
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-medium">{model.name}</div>
                            <div className="text-xs text-[#8e8ea0]">{getModelDescription(model)}</div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </>
            ) : (
              <div
                data-testid="locked-model-badge"
                title={t('chat.modelLockedTooltip')}
                className="inline-flex items-center gap-2 rounded-xl border border-white/5 bg-[#262626] px-3 py-1.5 text-sm font-semibold text-[#ececec]"
              >
                <ModelIcon modelId={selectedModel} className="h-4 w-4 shrink-0" />
                <span>{activeModelName}</span>
                <Lock className="h-3.5 w-3.5 text-[#8e8ea0]" aria-label={t('chat.modelLockedAria')} />
              </div>
            )}
          </div>
        </div>

        {/* Right Header Controls */}
        <div className="flex items-center gap-2">
          <LanguageSwitcher />

          {!isAuthenticated && onOpenAuth && (
            <button
              type="button"
              onClick={onOpenAuth}
              className="inline-flex items-center gap-1.5 rounded-full border border-sky-400/30 bg-sky-500/10 px-3 py-1 text-xs font-medium text-sky-200 transition-colors hover:bg-sky-500/20 hover:text-white"
              title={t('chat.signInTitle')}
            >
              <LogIn className="h-3.5 w-3.5" />
              <span>{t('common.signIn')}</span>
            </button>
          )}

          {isAdmin && (
            <button
              type="button"
              onClick={onOpenAdmin}
              className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-[#2a2a2a] px-3 py-1 text-xs font-medium text-[#d1d5db] transition-colors hover:border-white/20 hover:bg-[#333333] hover:text-white"
              title={t('sidebar.adminConsoleTitle')}
              aria-label={t('chat.adminAria')}
            >
              <Shield className="h-3.5 w-3.5 text-[#10a37f]" />
              <span>{t('chat.adminBadge')}</span>
            </button>
          )}

          <button
            type="button"
            onClick={onOpenSettings}
            className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-[#2a2a2a] px-3 py-1 text-xs font-medium text-[#d1d5db] transition-colors hover:border-white/20 hover:bg-[#333333] hover:text-white"
            title={t('chat.configureBotTitle')}
          >
            <span
              className={[
                'h-2 w-2 rounded-full',
                botMode === 'api' ? 'bg-sky-400' : 'bg-[#10a37f]',
              ].join(' ')}
            />
            <span className="hidden sm:inline">
              {botMode === 'api' ? t('chat.modeApi') : t('chat.modeSimulated')}
            </span>
            <Settings className="h-3.5 w-3.5 text-[#8e8ea0]" />
          </button>
        </div>
      </header>

      {/* Scrollable Chat Messages Area */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="relative flex-1 overflow-y-auto"
      >
        {messages.length === 0 ? (
          <div className="mx-auto flex h-full max-w-3xl flex-col items-center justify-center px-4 py-12">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-white/15 bg-[#2f2f2f]">
              <ModelIcon modelId={selectedModel} className="h-6 w-6" />
            </div>
            <h1 className="mb-2 text-center text-2xl font-semibold text-white sm:text-3xl">
              {t('chat.emptyHeading')}
            </h1>
            <p className="mb-8 max-w-md text-center text-sm text-[#8e8ea0]">
              {t('chat.emptySubheadingBefore')}
              <span className="font-medium text-[#ececec]">{activeModelName}</span>
              {t('chat.emptySubheadingAfter')}
            </p>

            <div className="grid w-full max-w-2xl grid-cols-1 gap-3 sm:grid-cols-2">
              {STARTER_PROMPTS.map((item, idx) => {
                const titleKey = `starter.${idx + 1}.title` as TranslationKey;
                const promptKey = `starter.${idx + 1}.prompt` as TranslationKey;
                const localizedTitle = t(titleKey) === titleKey ? item.title : t(titleKey);
                const localizedPrompt = t(promptKey) === promptKey ? item.prompt : t(promptKey);
                return (
                  <button
                    key={item.title}
                    type="button"
                    disabled={isUserSuspended}
                    onClick={() => onSendMessage(localizedPrompt)}
                    className="group rounded-2xl border border-white/10 bg-[#272727] p-4 text-left transition-colors hover:border-white/20 hover:bg-[#2f2f2f] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <div className="text-sm font-medium text-[#ececec] group-hover:text-white">
                      {localizedTitle}
                    </div>
                    <div className="mt-1 line-clamp-2 text-xs text-[#8e8ea0]">{localizedPrompt}</div>
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="mx-auto w-full max-w-3xl px-4 py-6">
            {messages.map((message) => (
              <MessageBubble
                key={message.id}
                message={message}
                userProfile={userProfile}
                modelId={selectedModel}
                isLastAssistantMessage={message.id === lastAssistantId}
                isStreamingAny={isStreaming}
                onRegenerate={onRegenerate}
              />
            ))}
            <div ref={bottomAnchorRef} className="h-4" />
          </div>
        )}
      </div>

      {/* Scroll-to-bottom button */}
      {showScrollBottom && (
        <div className="pointer-events-none absolute right-0 bottom-28 left-0 flex justify-center">
          <button
            type="button"
            onClick={scrollToBottom}
            className="pointer-events-auto flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-[#2f2f2f] text-[#ececec] shadow-lg transition-colors hover:bg-[#3a3a3a]"
            aria-label={t('chat.scrollToBottom')}
            title={t('chat.scrollToBottom')}
          >
            <ArrowDown className="h-4 w-4" />
          </button>
        </div>
      )}

      {isUserSuspended && (
        <div className="mx-auto mb-1 flex w-full max-w-3xl items-center gap-2 px-4">
          <div className="flex w-full items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3.5 py-2 text-xs text-amber-200">
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400" />
            <span>{t('chat.suspendedBanner')}</span>
          </div>
        </div>
      )}

      {/* Bottom Message Composer */}
      <ChatInput
        value={draftInput}
        isStreaming={isStreaming}
        disabled={isUserSuspended}
        onChange={onDraftChange}
        onSubmit={() => onSendMessage()}
        onStop={onStopStreaming}
      />
    </main>
  );
}
