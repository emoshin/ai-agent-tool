import type { ManagedUser } from '../types/admin';
import { AVATAR_PRESETS, DEFAULT_USER_PROFILE, INITIAL_CHATS } from './defaults';
import { computeChatsTokenBreakdown } from './tokens';

const now = Date.now();
const HOUR = 3600 * 1000;
const DAY = 24 * HOUR;

const currentUserUsage = computeChatsTokenBreakdown(INITIAL_CHATS);

export const CURRENT_USER_ID = 'user-current';

export const INITIAL_MANAGED_USERS: ManagedUser[] = [
  {
    id: CURRENT_USER_ID,
    name: DEFAULT_USER_PROFILE.name,
    email: 'alex.morgan@ai-agent-tool.dev',
    role: 'admin',
    status: 'active',
    avatarUrl: DEFAULT_USER_PROFILE.avatarUrl,
    createdAt: now - 30 * DAY,
    lastActiveAt: now - 2 * HOUR,
    isCurrentUser: true,
    tokenUsage: {
      promptTokens: currentUserUsage.promptTokens + 18400,
      completionTokens: currentUserUsage.completionTokens + 42600,
      totalTokens: currentUserUsage.totalTokens + 61000,
      tokenLimit: 250000,
    },
    chats: INITIAL_CHATS,
  },
  {
    id: 'user-elena',
    name: 'Elena Rostova',
    email: 'elena.rostova@ai-agent-tool.dev',
    role: 'member',
    status: 'active',
    avatarUrl: AVATAR_PRESETS[1],
    createdAt: now - 21 * DAY,
    lastActiveAt: now - 45 * 60 * 1000,
    tokenUsage: {
      promptTokens: 54200,
      completionTokens: 129800,
      totalTokens: 184000,
      tokenLimit: 250000,
    },
    chats: [
      {
        id: 'elena-chat-1',
        title: 'Refactor Spring Boot WebFlux SSE controller',
        model: 'claude-sonnet-4',
        createdAt: now - 4 * HOUR,
        updatedAt: now - 45 * 60 * 1000,
        messages: [
          {
            id: 'elena-m1',
            role: 'user',
            content: 'How do I prevent SSE timeouts in Spring Boot when streaming long LLM responses?',
            createdAt: now - 4 * HOUR,
            tokenCount: 18,
          },
          {
            id: 'elena-m2',
            role: 'assistant',
            content:
              'Send periodic SSE heartbeat comments (`: keep-alive`) using `Flux.interval` merged with your token stream, and increase `spring.mvc.async.request-timeout` or configure Netty idle timeout on WebFlux.',
            createdAt: now - 4 * HOUR + 2000,
            tokenCount: 44,
          },
        ],
      },
      {
        id: 'elena-chat-2',
        title: 'PostgreSQL pgvector HNSW index tuning',
        model: 'gpt-4o',
        createdAt: now - 2 * DAY,
        updatedAt: now - 2 * DAY,
        messages: [
          {
            id: 'elena-m3',
            role: 'user',
            content: 'What values of m and ef_construction work well for 500k embeddings?',
            createdAt: now - 2 * DAY,
            tokenCount: 16,
          },
          {
            id: 'elena-m4',
            role: 'assistant',
            content:
              'Start with `m = 16` and `ef_construction = 64` (or `128` for higher recall). At query time, tune `SET hnsw.ef_search = 100;` to balance latency vs recall.',
            createdAt: now - 2 * DAY + 3000,
            tokenCount: 41,
          },
        ],
      },
    ],
  },
  {
    id: 'user-marcus',
    name: 'Marcus Vance',
    email: 'marcus.vance@ai-agent-tool.dev',
    role: 'member',
    status: 'suspended',
    avatarUrl: AVATAR_PRESETS[2],
    createdAt: now - 14 * DAY,
    lastActiveAt: now - 3 * DAY,
    tokenUsage: {
      promptTokens: 112500,
      completionTokens: 136900,
      totalTokens: 249400,
      tokenLimit: 250000,
    },
    chats: [
      {
        id: 'marcus-chat-1',
        title: 'Batch document summarization pipeline',
        model: 'claude-opus-4',
        createdAt: now - 3 * DAY,
        updatedAt: now - 3 * DAY,
        messages: [
          {
            id: 'marcus-m1',
            role: 'user',
            content: 'Generate summaries for 1,200 archived support tickets in parallel.',
            createdAt: now - 3 * DAY,
            tokenCount: 14,
          },
          {
            id: 'marcus-m2',
            role: 'assistant',
            content:
              'Use a bounded concurrency queue (e.g., 5 workers) with exponential backoff on HTTP 429 responses to avoid exhausting your workspace token quota.',
            createdAt: now - 3 * DAY + 1500,
            tokenCount: 33,
          },
        ],
      },
    ],
  },
  {
    id: 'user-priya',
    name: 'Priya Nair',
    email: 'priya.nair@ai-agent-tool.dev',
    role: 'viewer',
    status: 'active',
    avatarUrl: AVATAR_PRESETS[0],
    createdAt: now - 7 * DAY,
    lastActiveAt: now - DAY,
    tokenUsage: {
      promptTokens: 6400,
      completionTokens: 14200,
      totalTokens: 20600,
      tokenLimit: 100000,
    },
    chats: [
      {
        id: 'priya-chat-1',
        title: 'Release notes draft for v1.2',
        model: 'gpt-4o',
        createdAt: now - DAY,
        updatedAt: now - DAY,
        messages: [
          {
            id: 'priya-m1',
            role: 'user',
            content: 'Draft concise release notes for adding the React Chat UI and Admin Console.',
            createdAt: now - DAY,
            tokenCount: 17,
          },
          {
            id: 'priya-m2',
            role: 'assistant',
            content:
              '### v1.2 Release Highlights\n- **ChatGPT-style React UI**: Collapsible sidebar, Markdown code blocks, and streaming replies.\n- **Admin Console**: Manage users, monitor token quotas, and inspect conversation histories.',
            createdAt: now - DAY + 1800,
            tokenCount: 42,
          },
        ],
      },
    ],
  },
];
