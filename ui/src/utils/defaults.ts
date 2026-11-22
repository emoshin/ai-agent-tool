import type { BotSettings, ChatSession, ModelOption, ModelProvider, UserProfile } from '../types/chat';

export const DEFAULT_AVATAR_SVG =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#10a37f"/>
          <stop offset="100%" stop-color="#2563eb"/>
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="32" fill="url(#bg)"/>
      <circle cx="32" cy="24" r="10.5" fill="#f8fafc" fill-opacity="0.95"/>
      <path d="M14 54c2.4-10.2 9.6-16 18-16s15.6 5.8 18 16" fill="#f8fafc" fill-opacity="0.95"/>
    </svg>`
  );

export const AVATAR_PRESETS: string[] = [
  DEFAULT_AVATAR_SVG,
  "data:image/svg+xml;utf8," +
    encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id="bg2" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stop-color="#8b5cf6"/>
            <stop offset="100%" stop-color="#ec4899"/>
          </linearGradient>
        </defs>
        <rect width="64" height="64" rx="32" fill="url(#bg2)"/>
        <circle cx="32" cy="24" r="10.5" fill="#fff"/>
        <path d="M14 54c2.4-10.2 9.6-16 18-16s15.6 5.8 18 16" fill="#fff"/>
      </svg>`
    ),
  "data:image/svg+xml;utf8," +
    encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id="bg3" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stop-color="#f59e0b"/>
            <stop offset="100%" stop-color="#ef4444"/>
          </linearGradient>
        </defs>
        <rect width="64" height="64" rx="32" fill="url(#bg3)"/>
        <circle cx="32" cy="24" r="10.5" fill="#fff"/>
        <path d="M14 54c2.4-10.2 9.6-16 18-16s15.6 5.8 18 16" fill="#fff"/>
      </svg>`
    ),
];

export const AVAILABLE_MODELS: ModelOption[] = [
  {
    id: 'gpt-4o',
    name: 'ChatGPT 4o',
    provider: 'openai',
    description: 'OpenAI flagship model for fast, versatile reasoning',
  },
  {
    id: 'o3-mini',
    name: 'ChatGPT o3-mini',
    provider: 'openai',
    description: 'OpenAI reasoning model for code, math, and architecture',
  },
  {
    id: 'claude-sonnet-4',
    name: 'Claude Sonnet 4',
    provider: 'anthropic',
    description: 'Anthropic balanced model for coding and clear analysis',
  },
  {
    id: 'claude-opus-4',
    name: 'Claude Opus 4',
    provider: 'anthropic',
    description: 'Anthropic deep reasoning model for complex engineering',
  },
];

export function getModelProvider(modelId: string): ModelProvider {
  const known = AVAILABLE_MODELS.find((m) => m.id === modelId);
  if (known) return known.provider;

  const lower = modelId.toLowerCase();
  if (lower.includes('claude') || lower.includes('anthropic')) {
    return 'anthropic';
  }
  if (
    lower.includes('gpt') ||
    lower.includes('chatgpt') ||
    lower.includes('openai') ||
    /^o[134](-|$)/.test(lower) ||
    lower === 'agent-4o' ||
    lower === 'agent-o3-mini'
  ) {
    return 'openai';
  }
  return 'custom';
}

export function getModelDisplayName(modelId: string): string {
  const known = AVAILABLE_MODELS.find((m) => m.id === modelId);
  if (known) return known.name;
  if (modelId === 'agent-4o') return 'ChatGPT 4o';
  if (modelId === 'agent-o3-mini') return 'ChatGPT o3-mini';
  return modelId;
}

export const DEFAULT_USER_PROFILE: UserProfile = {
  name: 'Alex Morgan',
  subtitle: 'Workspace Member',
  avatarUrl: DEFAULT_AVATAR_SVG,
};

export const DEFAULT_BOT_SETTINGS: BotSettings = {
  mode: 'simulated',
  apiEndpoint: '/api/chat',
  apiKey: '',
  defaultModel: 'gpt-4o',
  systemPrompt: 'You are a helpful, concise AI assistant integrated into ai-agent-tool.',
};

export const STARTER_PROMPTS = [
  {
    title: 'Design a Java + React architecture',
    prompt: 'How should I structure a Spring Boot or Java backend API to stream SSE responses to this React chat UI?',
  },
  {
    title: 'Write a TypeScript API client',
    prompt: 'Show me a clean TypeScript fetch wrapper with AbortController and retry handling.',
  },
  {
    title: 'Review a SQL query',
    prompt: 'Explain how to optimize a slow SQL query with composite indexes and provide an example.',
  },
  {
    title: 'Brainstorm AI agent tools',
    prompt: 'List 5 practical tools an AI coding agent should expose to developers.',
  },
];

const now = Date.now();
const HOUR = 3600 * 1000;
const DAY = 24 * HOUR;

export const INITIAL_CHATS: ChatSession[] = [
  {
    id: 'chat-welcome',
    title: 'Getting started with AI Bot UI',
    model: 'gpt-4o',
    createdAt: now - 2 * HOUR,
    updatedAt: now - 2 * HOUR,
    messages: [
      {
        id: 'msg-1',
        role: 'user',
        content: 'What can this AI Bot UI module do?',
        createdAt: now - 2 * HOUR,
      },
      {
        id: 'msg-2',
        role: 'assistant',
        content:
          "Welcome! This React module provides a **ChatGPT-style conversational interface** ready for your AI bot:\n\n" +
          '- **Collapsible left sidebar** with grouped conversation history, model icons, search, inline rename/delete, and your user profile image.\n' +
          '- **Per-chat model selection** when starting a new chat (ChatGPT or Anthropic Claude), locked for the duration of the conversation.\n' +
          '- **Dual bot adapter**: works immediately in **Simulated Mode** and switches seamlessly to your **REST / SSE backend API** via Settings.\n\n' +
          'Try asking a question below or click **Settings** in the bottom-left user panel to connect a live backend.',
        createdAt: now - 2 * HOUR + 1500,
      },
    ],
  },
  {
    id: 'chat-sse-example',
    title: 'SSE streaming contract for Java backend',
    model: 'claude-sonnet-4',
    createdAt: now - DAY - 3 * HOUR,
    updatedAt: now - DAY - 3 * HOUR,
    messages: [
      {
        id: 'msg-3',
        role: 'user',
        content: 'What response format does the API adapter expect?',
        createdAt: now - DAY - 3 * HOUR,
      },
      {
        id: 'msg-4',
        role: 'assistant',
        content:
          'The built-in `ApiBotAdapter` supports both **Server-Sent Events (SSE)** and standard **JSON** responses:\n\n' +
          '```json\n' +
          '// SSE chunk formats supported:\n' +
          'data: {"delta": "Hello "}\n' +
          'data: {"choices": [{"delta": {"content": "world!"}}]}\n' +
          'data: [DONE]\n' +
          '```\n\n' +
          'Or return a single JSON response with `{ "content": "..." }` or `{ "message": "..." }`.',
        createdAt: now - DAY - 3 * HOUR + 2000,
      },
    ],
  },
];
