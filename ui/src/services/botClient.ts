import type { BotSettings, ChatMessage } from '../types/chat';
import { getModelDisplayName } from '../utils/defaults';

export interface BotRequestOptions {
  chatId?: string;
  messages: ChatMessage[];
  model: string;
  settings: BotSettings;
  signal: AbortSignal;
  onToken: (delta: string) => void;
}

export interface BotAdapter {
  sendMessage(options: BotRequestOptions): Promise<void>;
}

function buildSimulatedResponse(prompt: string, model: string): string {
  const lower = prompt.toLowerCase();

  if (lower.includes('sse') || lower.includes('spring') || lower.includes('java') || lower.includes('backend')) {
    return (
      `Here is a clean **Java (Spring Boot) SSE** endpoint compatible with this React UI's \`ApiBotAdapter\`:\n\n` +
      `\`\`\`java\n` +
      `@PostMapping(value = "/api/chat", produces = MediaType.TEXT_EVENT_STREAM_VALUE)\n` +
      `public Flux<ServerSentEvent<Map<String, String>>> streamChat(@RequestBody ChatRequest req) {\n` +
      `    return aiService.streamTokens(req.messages(), req.model())\n` +
      `        .map(token -> ServerSentEvent.builder(Map.of("delta", token)).build());\n` +
      `}\n` +
      `\`\`\`\n\n` +
      `### How to connect it\n` +
      `1. Open **Settings** from the bottom-left user profile.\n` +
      `2. Switch **Bot Mode** to **REST / SSE API**.\n` +
      `3. Keep endpoint as \`/api/chat\` (Vite proxies \`/api\` to \`http://localhost:8080\`).`
    );
  }

  if (lower.includes('typescript') || lower.includes('fetch') || lower.includes('abort')) {
    return (
      `Here is a concise **TypeScript** fetch helper using \`AbortController\`:\n\n` +
      `\`\`\`ts\n` +
      `export async function fetchWithAbort(url: string, body: unknown, timeoutMs = 15_000) {\n` +
      `  const controller = new AbortController();\n` +
      `  const timer = setTimeout(() => controller.abort(), timeoutMs);\n` +
      `  try {\n` +
      `    const res = await fetch(url, {\n` +
      `      method: 'POST',\n` +
      `      headers: { 'Content-Type': 'application/json' },\n` +
      `      body: JSON.stringify(body),\n` +
      `      signal: controller.signal,\n` +
      `    });\n` +
      `    if (!res.ok) throw new Error(\`HTTP \${res.status}\`);\n` +
      `    return await res.json();\n` +
      `  } finally {\n` +
      `    clearTimeout(timer);\n` +
      `  }\n` +
      `}\n` +
      `\`\`\`\n\n` +
      `You can pass an external \`AbortSignal\` to let users cancel in-flight requests via the **Stop** button.`
    );
  }

  if (lower.includes('sql') || lower.includes('index') || lower.includes('query')) {
    return (
      `To speed up a slow SQL query, focus on **predicate selectivity** and **composite index column order**:\n\n` +
      `| Optimization | When to Use | Impact |\n` +
      `| --- | --- | --- |\n` +
      `| Equality columns first | \`WHERE tenant_id = ? AND created_at > ?\` | Narrow range scan |\n` +
      `| Covering index | Include small projected columns | Avoids heap/table lookups |\n` +
      `| Keyset pagination | Replace large \`OFFSET\` values | Constant-time paging |\n\n` +
      `\`\`\`sql\n` +
      `CREATE INDEX idx_messages_chat_created\n` +
      `  ON chat_messages (chat_id, created_at DESC);\n` +
      `\`\`\``
    );
  }

  if (lower.includes('tool') || lower.includes('agent')) {
    return (
      `Five high-leverage tools for a developer **AI coding agent**:\n\n` +
      `1. **Workspace File Search & Read** — fast symbol and content lookup.\n` +
      `2. **Targeted Patch / Diff Editor** — minimal, verifiable edits.\n` +
      `3. **Sandboxed Test Runner** — runs unit tests and reports structured failures.\n` +
      `4. **Git Status & Diff Inspector** — keeps changes grounded and reviewable.\n` +
      `5. **HTTP / Schema Inspector** — validates live API contracts against frontend types.`
    );
  }

  const trimmed = prompt.trim();
  const preview = trimmed.length > 120 ? `${trimmed.slice(0, 120)}...` : trimmed;

  return (
    `Response from **${getModelDisplayName(model)}** (Simulated Mode):\n\n` +
    `I received your prompt:\n` +
    `> ${preview}\n\n` +
    `Here are a few things we can explore next:\n` +
    `- Ask for **code snippets** (e.g., TypeScript, Java, SQL) to see syntax-styled code blocks with one-click copy.\n` +
    `- Use **Stop** while streaming or **Regenerate** on any completed assistant message.\n` +
    `- Open **Settings** in the sidebar footer to point this UI at a live REST/SSE backend.`
  );
}

function waitWithAbort(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException('Aborted', 'AbortError'));
      return;
    }
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(new DOMException('Aborted', 'AbortError'));
    };
    signal.addEventListener('abort', onAbort, { once: true });
  });
}

export class SimulatedBotAdapter implements BotAdapter {
  private readonly chunkDelayMs: number;

  constructor(chunkDelayMs = 18) {
    this.chunkDelayMs = chunkDelayMs;
  }

  async sendMessage({ messages, model, signal, onToken }: BotRequestOptions): Promise<void> {
    const lastUserMessage = [...messages].reverse().find((m) => m.role === 'user')?.content ?? '';
    const fullText = buildSimulatedResponse(lastUserMessage, model);

    // Stream by small word/whitespace tokens to mimic real LLM token streaming
    const tokens = fullText.match(/\S+\s*/g) ?? [fullText];

    await waitWithAbort(140, signal);
    for (const token of tokens) {
      if (signal.aborted) {
        throw new DOMException('Aborted', 'AbortError');
      }
      onToken(token);
      if (this.chunkDelayMs > 0) {
        await waitWithAbort(this.chunkDelayMs, signal);
      }
    }
  }
}

function extractDeltaFromJsonPayload(payload: unknown): string {
  if (!payload || typeof payload !== 'object') return '';
  const obj = payload as Record<string, unknown>;

  if (typeof obj.delta === 'string') return obj.delta;
  if (typeof obj.token === 'string') return obj.token;
  if (typeof obj.content === 'string') return obj.content;
  if (typeof obj.text === 'string') return obj.text;
  if (typeof obj.message === 'string') return obj.message;

  if (Array.isArray(obj.choices) && obj.choices.length > 0) {
    const first = obj.choices[0] as Record<string, unknown>;
    const delta = first.delta as Record<string, unknown> | undefined;
    if (delta && typeof delta.content === 'string') return delta.content;
    const message = first.message as Record<string, unknown> | undefined;
    if (message && typeof message.content === 'string') return message.content;
  }
  return '';
}

export class ApiBotAdapter implements BotAdapter {
  async sendMessage({ chatId, messages, model, settings, signal, onToken }: BotRequestOptions): Promise<void> {
    const endpoint = settings.apiEndpoint.trim();
    if (!endpoint) {
      throw new Error('API endpoint URL is empty. Configure it in Settings.');
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (settings.apiKey.trim()) {
      headers.Authorization = `Bearer ${settings.apiKey.trim()}`;
    }

    const payloadMessages = [
      ...(settings.systemPrompt.trim()
        ? [{ role: 'system', content: settings.systemPrompt.trim() }]
        : []),
      ...messages
        .filter((m) => !m.isError)
        .map((m) => ({ role: m.role, content: m.content })),
    ];

    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      signal,
      body: JSON.stringify({
        ...(chatId ? { chatId } : {}),
        model,
        stream: true,
        messages: payloadMessages,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      const err = new Error(
        `Bot API error (${response.status} ${response.statusText})${errorText ? `: ${errorText.slice(0, 200)}` : ''}`
      ) as Error & { status?: number };
      err.status = response.status;
      throw err;
    }

    const contentType = response.headers.get('content-type') ?? '';
    if (!response.body || (!contentType.includes('text/event-stream') && contentType.includes('application/json'))) {
      const data: unknown = await response.json();
      const text = extractDeltaFromJsonPayload(data);
      if (text) {
        onToken(text);
      } else {
        throw new Error('Bot API returned JSON without recognizable content/message fields.');
      }
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith(':')) continue;

        if (trimmed.startsWith('data:')) {
          const dataStr = trimmed.slice(5).trim();
          if (!dataStr || dataStr === '[DONE]') continue;
          try {
            const parsed: unknown = JSON.parse(dataStr);
            const delta = extractDeltaFromJsonPayload(parsed);
            if (delta) onToken(delta);
          } catch {
            // If server sends plain text SSE data lines, emit directly
            onToken(dataStr);
          }
        } else {
          try {
            const parsed: unknown = JSON.parse(trimmed);
            const delta = extractDeltaFromJsonPayload(parsed);
            if (delta) onToken(delta);
          } catch {
            onToken(trimmed);
          }
        }
      }
    }

    if (buffer.trim()) {
      const remaining = buffer.trim().replace(/^data:\s*/, '');
      if (remaining && remaining !== '[DONE]') {
        try {
          const parsed: unknown = JSON.parse(remaining);
          const delta = extractDeltaFromJsonPayload(parsed);
          if (delta) onToken(delta);
        } catch {
          onToken(remaining);
        }
      }
    }
  }
}

export async function sendBotMessage(
  options: BotRequestOptions,
  adapters?: { simulated?: BotAdapter; api?: BotAdapter }
): Promise<void> {
  const adapter =
    options.settings.mode === 'api'
      ? (adapters?.api ?? new ApiBotAdapter())
      : (adapters?.simulated ?? new SimulatedBotAdapter());

  return adapter.sendMessage(options);
}
