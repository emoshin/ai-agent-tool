import { describe, expect, it, vi } from 'vitest';
import { ApiBotAdapter, SimulatedBotAdapter } from './botClient';
import { DEFAULT_BOT_SETTINGS } from '../utils/defaults';

describe('botClient adapters', () => {
  it('SimulatedBotAdapter streams tokens and respects AbortSignal', async () => {
    const adapter = new SimulatedBotAdapter(0);
    const controller = new AbortController();
    const tokens: string[] = [];

    await adapter.sendMessage({
      messages: [{ id: '1', role: 'user', content: 'Help with SQL query', createdAt: 1 }],
      model: 'agent-4o',
      settings: DEFAULT_BOT_SETTINGS,
      signal: controller.signal,
      onToken: (delta) => tokens.push(delta),
    });

    expect(tokens.join('')).toContain('CREATE INDEX');
  });

  it('ApiBotAdapter parses SSE streaming chunks from a backend endpoint', async () => {
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode('data: {"delta":"Hello "}\n\n'));
        controller.enqueue(
          encoder.encode('data: {"choices":[{"delta":{"content":"SSE world"}}]}\n\n')
        );
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
      },
    });

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(stream, {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
      })
    );
    vi.stubGlobal('fetch', fetchMock);

    const adapter = new ApiBotAdapter();
    const tokens: string[] = [];
    const controller = new AbortController();

    await adapter.sendMessage({
      messages: [{ id: '1', role: 'user', content: 'Hi', createdAt: 1 }],
      model: 'agent-custom',
      settings: {
        ...DEFAULT_BOT_SETTINGS,
        mode: 'api',
        apiEndpoint: 'http://localhost:8080/api/chat',
        apiKey: 'secret-token',
      },
      signal: controller.signal,
      onToken: (delta) => tokens.push(delta),
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:8080/api/chat',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer secret-token',
        }),
      })
    );
    expect(tokens.join('')).toBe('Hello SSE world');

    vi.unstubAllGlobals();
  });
});
